import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { fileURLToPath } from 'url';
import db from '../db/knex.js';

// Prefer IPv4 resolution to prevent connection timeouts (Code 408) caused by broken local IPv6 routes on Windows/Node 18+
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrCode = null;
    this.connectionState = 'close'; // 'close', 'connecting', 'open'
    this.io = null; // Configured during server startup
    this.authPath = path.resolve(__dirname, '../../data/whatsapp-auth');
    
    // Ensure parent folders exist
    if (!fs.existsSync(path.dirname(this.authPath))) {
      fs.mkdirSync(path.dirname(this.authPath), { recursive: true });
    }

    this.loadLidMapping();
    this.ensureDbSchema();
    this.profilePicCache = new Map();
  }

  async ensureDbSchema() {
    try {
      const hasMensagemId = await db.schema.hasColumn('mensagens_whatsapp', 'mensagem_id');
      if (!hasMensagemId) {
        await db.schema.table('mensagens_whatsapp', (table) => {
          table.string('mensagem_id').nullable().index();
        });
        console.log('[WhatsApp] Adicionada coluna mensagem_id à tabela mensagens_whatsapp.');
      }
      
      const hasStatus = await db.schema.hasColumn('mensagens_whatsapp', 'status');
      if (!hasStatus) {
        await db.schema.table('mensagens_whatsapp', (table) => {
          table.integer('status').defaultTo(2); // 2 = sent
        });
        console.log('[WhatsApp] Adicionada coluna status à tabela mensagens_whatsapp.');
      }
    } catch (err) {
      console.error('[WhatsApp] Erro ao atualizar schema do banco:', err);
    }
  }

  loadLidMapping() {
    this.lidMappingPath = path.resolve(__dirname, '../../data/lid-mapping.json');
    this.lidToPhoneMap = new Map();
    
    if (fs.existsSync(this.lidMappingPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.lidMappingPath, 'utf-8'));
        for (const [lid, phone] of Object.entries(data)) {
          this.lidToPhoneMap.set(lid, phone);
        }
        console.log(`[WhatsApp] Carregados ${this.lidToPhoneMap.size} mapeamentos LID.`);
      } catch (err) {
        console.error('[WhatsApp] Erro ao carregar lid-mapping.json:', err);
      }
    }
  }

  saveLidMapping() {
    try {
      const obj = {};
      for (const [lid, phone] of this.lidToPhoneMap.entries()) {
        obj[lid] = phone;
      }
      fs.writeFileSync(this.lidMappingPath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('[WhatsApp] Erro ao salvar lid-mapping.json:', err);
    }
  }

  registerLidPhoneMapping(lid, phone) {
    if (!lid || !phone) return;
    const cleanLid = lid.replace('@lid', '').replace(/\D/g, '');
    const cleanPhone = phone.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    
    if (cleanLid && cleanPhone && this.lidToPhoneMap.get(cleanLid) !== cleanPhone) {
      this.lidToPhoneMap.set(cleanLid, cleanPhone);
      console.log(`[WhatsApp] Registrado mapeamento LID: ${cleanLid} -> Telefone: ${cleanPhone}`);
      this.saveLidMapping();
    }
  }

  resolveLidToPhone(lid) {
    const cleanLid = lid.replace('@lid', '').replace(/\D/g, '');
    const phone = this.lidToPhoneMap.get(cleanLid);
    return phone ? `${phone}@s.whatsapp.net` : null;
  }

  getLidForPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    for (const [lid, ph] of this.lidToPhoneMap.entries()) {
      if (ph === cleanPhone) {
        return `${lid}@lid`;
      }
    }
    return null;
  }

  async getProfilePictureUrl(jid) {
    if (!this.sock || this.connectionState !== 'open') return null;
    
    // Check cache
    const cached = this.profilePicCache.get(jid);
    const ONE_HOUR = 1000 * 60 * 60;
    
    if (cached && (Date.now() - cached.timestamp < ONE_HOUR)) {
      return cached.url;
    }
    
    // If not in cache or expired, trigger background fetch
    this.fetchProfilePictureInBackground(jid);
    
    // Return old cached value if available, otherwise null
    return cached ? cached.url : null;
  }

  async fetchProfilePictureInBackground(jid) {
    // Avoid double fetching
    const pendingKey = `fetching-${jid}`;
    if (this.profilePicCache.get(pendingKey)) return;
    
    this.profilePicCache.set(pendingKey, true);
    
    try {
      console.log(`[WhatsApp] Buscando foto de perfil em segundo plano para: ${jid}`);
      const url = await this.sock.profilePictureUrl(jid, 'image');
      
      this.profilePicCache.set(jid, {
        url,
        timestamp: Date.now()
      });
      
      // Emit socket update to frontend
      if (this.io) {
        this.io.emit('whatsapp_foto_atualizada', {
          contato_whatsapp: jid.split('@')[0],
          foto_url: url
        });
      }
    } catch (err) {
      // If contact has no profile picture or privacy blocked, cache null
      this.profilePicCache.set(jid, {
        url: null,
        timestamp: Date.now()
      });
    } finally {
      this.profilePicCache.delete(pendingKey);
    }
  }

  setSocketIO(io) {
    this.io = io;
  }

  async init() {
    console.log('[WhatsApp] Inicializando cliente Baileys...');
    const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
    
    try {
      // Dynamically fetch the latest WhatsApp Web version to avoid connection rejection
      let version = [2, 3000, 1015901307]; // Safe fallback version
      try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
        console.log(`[WhatsApp] Versão do WhatsApp Web obtida: ${version.join('.')}`);
      } catch (versionErr) {
        console.warn('[WhatsApp] Não foi possível obter a versão dinâmica do WhatsApp Web, usando fallback:', versionErr.message);
      }

      const initSocket = makeWASocket.default || makeWASocket;
      this.sock = initSocket({
        version,
        auth: state,
        printQRInTerminal: false, // Deprecated, handled by web UI
        logger: pino({ level: 'silent' }),
        connectTimeoutMs: 60000, // 60 seconds connection timeout limit
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true
      });

      this.connectionState = 'connecting';
      this.emitSocketUpdate();

      this.sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          this.emitSocketUpdate();
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`[WhatsApp] Conexão encerrada (Status Code: ${statusCode}). Reconectando? ${shouldReconnect}`);
          
          this.connectionState = 'close';
          this.qrCode = null;
          this.emitSocketUpdate();
          
          if (shouldReconnect) {
            setTimeout(() => this.init(), 5000);
          }
        } else if (connection === 'open') {
          console.log('[WhatsApp] WhatsApp conectado e pronto para uso!');
          this.connectionState = 'open';
          this.qrCode = null;
          this.emitSocketUpdate();
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
 
      // Listen for message status updates (e.g. read receipts, delivery, error)
      this.sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          if (update.update && update.update.status !== undefined) {
            const messageId = update.key.id;
            const newStatus = update.update.status;
            try {
              const affectedRows = await db('mensagens_whatsapp')
                .where({ mensagem_id: messageId })
                .andWhere(function() {
                  this.where('status', '<', newStatus).orWhereNull('status');
                })
                .update({ status: newStatus });
                
              if (affectedRows > 0) {
                const updatedMsg = await db('mensagens_whatsapp')
                  .where({ mensagem_id: messageId })
                  .first();
                  
                if (this.io && updatedMsg) {
                  this.io.emit('whatsapp_mensagem_status', {
                    id: updatedMsg.id,
                    mensagem_id: messageId,
                    status: newStatus
                  });
                }
              }
            } catch (err) {
              console.error(`[WhatsApp] Erro ao atualizar status da mensagem ${messageId}:`, err);
            }
          }
        }
      });

      // Listen for historical chat sync on connection pairing
      this.sock.ev.on('messaging-history.set', async ({ chats, messages, contacts, isLatest }) => {
        console.log(`[WhatsApp] Sincronizando histórico do WhatsApp: ${messages?.length || 0} mensagens e ${contacts?.length || 0} contatos...`);
        
        try {
          if (messages && messages.length > 0) {
            for (const msg of messages) {
              const sender = msg.key.remoteJid;
              let phoneJid = sender;
              
              if (sender) {
                // If it is a LID and fromMe is false (inbound), record the mapping
                if (!msg.key.fromMe && sender.endsWith('@lid') && msg.key.senderPn) {
                  this.registerLidPhoneMapping(sender, msg.key.senderPn);
                  phoneJid = msg.key.senderPn;
                } 
                // If it is a LID and fromMe is true (outbound), resolve using mapping
                else if (sender.endsWith('@lid')) {
                  const resolved = this.resolveLidToPhone(sender);
                  if (resolved) {
                    phoneJid = resolved;
                  }
                }
              }

              const realMsg = this.getRealMessage(msg.message);
              if (!realMsg) continue;

              const messageType = Object.keys(realMsg)[0];
              const isMedia = ['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(messageType);
              const text = realMsg.conversation || realMsg.extendedTextMessage?.text || '';
              
              if ((text || isMedia) && phoneJid && phoneJid.endsWith('@s.whatsapp.net')) {
                const contactNum = phoneJid.replace('@s.whatsapp.net', '');
                const isMe = msg.key.fromMe;
                const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date();

                let dbMessageText = text;
                if (isMedia) {
                  const mediaData = await this.downloadAndSaveMedia(msg);
                  if (mediaData) {
                    dbMessageText = JSON.stringify(mediaData);
                  } else {
                    // Fallback descriptive text if companion device cannot download self-sent media
                    if (messageType === 'imageMessage') dbMessageText = '📷 Imagem (Enviada do celular)';
                    else if (messageType === 'audioMessage') dbMessageText = '🎵 Áudio (Enviado do celular)';
                    else if (messageType === 'videoMessage') dbMessageText = '🎥 Vídeo (Enviado do celular)';
                    else if (messageType === 'documentMessage') {
                      const docName = realMsg.documentMessage?.fileName || 'Documento';
                      dbMessageText = `📄 Documento: ${docName} (Enviado do celular)`;
                    } else {
                      dbMessageText = '📎 Arquivo de mídia';
                    }
                  }
                }

                // Prevent duplicate inserts
                const existing = await db('mensagens_whatsapp')
                  .where({
                    contato_whatsapp: contactNum,
                    mensagem: dbMessageText,
                    timestamp: timestamp
                  }).first();

                if (!existing) {
                  await db('mensagens_whatsapp').insert({
                    contato_whatsapp: contactNum,
                    mensagem: dbMessageText,
                    direcao: isMe ? 'outbound' : 'inbound',
                    mensagem_id: msg.key.id,
                    status: msg.status || (isMe ? 2 : 4),
                    timestamp: timestamp
                  });
                }
              }
            }
          }

          if (contacts && contacts.length > 0) {
            for (const contact of contacts) {
              if (contact.id && contact.id.endsWith('@s.whatsapp.net')) {
                const contactNum = contact.id.replace('@s.whatsapp.net', '');
                const name = contact.name || contact.notify || contact.verifiedName;

                if (name) {
                  const existing = await db('clientes').where({ whatsapp: contactNum }).first();
                  if (!existing) {
                    await db('clientes').insert({
                      nome: name,
                      whatsapp: contactNum,
                      tipo: 'Externo', // Default to external
                      created_at: new Date()
                    });
                  }
                }
              }
            }
          }

          console.log('[WhatsApp] Sincronização de histórico concluída.');

          // Broadcast reload trigger to frontend clients
          if (this.io) {
            this.io.emit('whatsapp_mensagem', { reload: true });
          }
        } catch (err) {
          console.error('[WhatsApp] Erro ao processar histórico recebido:', err);
        }
      });

      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
          for (const msg of m.messages) {
            // Process text and media messages (both incoming and self-sent)
            if (msg.message) {
              const sender = msg.key.remoteJid;
              let phoneJid = sender;
              
              if (sender) {
                // If it is a LID and fromMe is false (inbound), record the mapping
                if (!msg.key.fromMe && sender.endsWith('@lid') && msg.key.senderPn) {
                  this.registerLidPhoneMapping(sender, msg.key.senderPn);
                  phoneJid = msg.key.senderPn;
                } 
                // If it is a LID and fromMe is true (outbound), resolve using mapping
                else if (sender.endsWith('@lid')) {
                  const resolved = this.resolveLidToPhone(sender);
                  if (resolved) {
                    phoneJid = resolved;
                  }
                }
              }

              const realMsg = this.getRealMessage(msg.message);
              if (!realMsg) continue;

              const messageType = Object.keys(realMsg)[0];
              const isMedia = ['imageMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(messageType);
              const text = realMsg.conversation || realMsg.extendedTextMessage?.text || '';
              
              if ((text || isMedia) && phoneJid && phoneJid.endsWith('@s.whatsapp.net')) {
                const cleanedNumber = phoneJid.replace('@s.whatsapp.net', '');
                const isMe = msg.key.fromMe;
                
                let dbMessageText = text;
                if (isMedia) {
                  const mediaData = await this.downloadAndSaveMedia(msg);
                  if (mediaData) {
                    dbMessageText = JSON.stringify(mediaData);
                  } else {
                    // Fallback descriptive text if companion device cannot download self-sent media
                    if (messageType === 'imageMessage') dbMessageText = '📷 Imagem (Enviada do celular)';
                    else if (messageType === 'audioMessage') dbMessageText = '🎵 Áudio (Enviado do celular)';
                    else if (messageType === 'videoMessage') dbMessageText = '🎥 Vídeo (Enviado do celular)';
                    else if (messageType === 'documentMessage') {
                      const docName = realMsg.documentMessage?.fileName || 'Documento';
                      dbMessageText = `📄 Documento: ${docName} (Enviado do celular)`;
                    } else {
                      dbMessageText = '📎 Arquivo de mídia';
                    }
                  }
                }

                try {
                  // Fetch the last 5 messages for this contact from the DB to safely prevent duplicates
                  const recentMessages = await db('mensagens_whatsapp')
                    .where({ contato_whatsapp: cleanedNumber })
                    .orderBy('id', 'desc')
                    .limit(5);

                  const isDuplicate = recentMessages.some(m => 
                    m.mensagem === dbMessageText && 
                    m.direcao === (isMe ? 'outbound' : 'inbound')
                  );

                  if (!isDuplicate) {
                    // Save incoming/outgoing message in database
                    const [newMessageId] = await db('mensagens_whatsapp').insert({
                      contato_whatsapp: cleanedNumber,
                      mensagem: dbMessageText,
                      direcao: isMe ? 'outbound' : 'inbound',
                      mensagem_id: msg.key.id,
                      status: msg.status || (isMe ? 2 : 4),
                      timestamp: new Date()
                    });

                    const savedMsg = await db('mensagens_whatsapp').where({ id: newMessageId }).first();

                    // Broadcast message to Web UI in real-time
                    if (this.io) {
                      this.io.emit('whatsapp_mensagem', savedMsg);
                    }
                  }
                } catch (err) {
                  console.error('[WhatsApp] Erro ao salvar mensagem no DB:', err);
                }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('[WhatsApp] Falha ao inicializar o serviço:', err);
      this.connectionState = 'close';
      this.emitSocketUpdate();
    }
  }

  async downloadAndSaveMedia(msg) {
    const realMsg = this.getRealMessage(msg.message);
    if (!realMsg) return null;

    const messageType = Object.keys(realMsg || {})[0];
    const isImage = messageType === 'imageMessage';
    const isAudio = messageType === 'audioMessage';
    const isVideo = messageType === 'videoMessage';
    const isDocument = messageType === 'documentMessage';

    if (!isImage && !isAudio && !isVideo && !isDocument) {
      return null;
    }

    try {
      console.log(`[WhatsApp] Baixando anexo do tipo: ${messageType}...`);
      
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { 
          logger: pino({ level: 'silent' }),
          rekey: false 
        }
      );
      
      let ext = 'bin';
      let mediaType = 'document';
      let originalName = 'arquivo';
      let caption = '';

      if (isImage) {
        ext = 'jpg';
        mediaType = 'image';
        caption = realMsg.imageMessage.caption || '';
      } else if (isAudio) {
        ext = 'ogg';
        mediaType = 'audio';
      } else if (isVideo) {
        ext = 'mp4';
        mediaType = 'video';
        caption = realMsg.videoMessage.caption || '';
      } else if (isDocument) {
        mediaType = 'document';
        originalName = realMsg.documentMessage.fileName || 'documento';
        const parts = originalName.split('.');
        ext = parts.length > 1 ? parts.pop() : 'bin';
      }

      const filename = `${Date.now()}-${Math.round(Math.random() * 10000)}.${ext}`;
      const mediaDir = path.resolve(__dirname, '../../data/media');
      
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
      }

      const filePath = path.join(mediaDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      
      const fileUrl = `/media/${filename}`;
      console.log(`[WhatsApp] Mídia salva com sucesso em: ${filePath}`);

      return {
        mediaType,
        url: fileUrl,
        fileName: originalName,
        text: caption
      };
    } catch (err) {
      console.error('[WhatsApp] Falha ao baixar anexo de mídia:', err);
      return null;
    }
  }

  getRealMessage(message) {
    if (!message) return null;
    if (message.ephemeralMessage) {
      return this.getRealMessage(message.ephemeralMessage.message);
    }
    if (message.viewOnceMessage) {
      return this.getRealMessage(message.viewOnceMessage.message);
    }
    if (message.viewOnceMessageV2) {
      return this.getRealMessage(message.viewOnceMessageV2.message);
    }
    if (message.documentWithCaptionMessage) {
      return this.getRealMessage(message.documentWithCaptionMessage.message);
    }
    return message;
  }

  emitSocketUpdate() {
    if (this.io) {
      this.io.emit('whatsapp_status', this.getConnectionStatus());
    }
  }

  getConnectionStatus() {
    return {
      status: this.connectionState,
      qr: this.qrCode
    };
  }

  async disconnect() {
    try {
      this.connectionState = 'close';
      this.qrCode = null;

      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (e) {
          // Socket might already be closed
        }
        this.sock = null;
      }

      // Clear authentication folder recursively to delete old session
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });
      }

      // Wipe messages from database to clean up mock or old messages
      await db('mensagens_whatsapp').del();

      this.emitSocketUpdate();
      console.log('[WhatsApp] Desconectado com sucesso e credenciais excluídas.');

      // Restart service to await new pairing code scan
      this.init();
    } catch (error) {
      console.error('[WhatsApp] Erro ao desconectar cliente:', error);
      throw error;
    }
  }

  async sendMessage(number, text) {
    if (this.connectionState !== 'open') {
      throw new Error('Não é possível enviar mensagem: WhatsApp desconectado.');
    }

    let jid = number;

    // Resolve the official registered WhatsApp JID if we only have the raw phone number
    if (!number.includes('@')) {
      let cleanNum = number.replace(/\D/g, '');
      if (!cleanNum.startsWith('55') && cleanNum.length <= 11) {
        cleanNum = '55' + cleanNum;
      }
      
      try {
        const [result] = await this.sock.onWhatsApp(cleanNum);
        if (result && result.exists) {
          jid = result.jid;
          console.log(`[WhatsApp] JID oficial resolvido: ${jid} (para o número ${cleanNum})`);
        } else {
          jid = `${cleanNum}@s.whatsapp.net`;
        }
      } catch (err) {
        console.warn(`[WhatsApp] Falha ao resolver JID via onWhatsApp para ${cleanNum}, usando fallback:`, err.message);
        jid = `${cleanNum}@s.whatsapp.net`;
      }
    }

    console.log(`[WhatsApp] Despachando mensagem para o JID: ${jid}`);
    const sentMsg = await this.sock.sendMessage(jid, { text });

    // Clean phone number structure for SQLite storage compatibility
    const cleanDbNumber = jid.split('@')[0].replace(/\D/g, '');

    // Store outgoing message in database
    try {
      const [newMessageId] = await db('mensagens_whatsapp').insert({
        contato_whatsapp: cleanDbNumber,
        mensagem: text,
        direcao: 'outbound',
        mensagem_id: sentMsg.key.id,
        status: 2, // 2 = sent / server ack
        timestamp: new Date()
      });

      const savedMsg = await db('mensagens_whatsapp').where({ id: newMessageId }).first();

      // Emit to Web UI
      if (this.io) {
        this.io.emit('whatsapp_mensagem', savedMsg);
      }
      
      return savedMsg;
    } catch (err) {
      console.error('[WhatsApp] Erro ao salvar mensagem enviada no DB:', err);
    }
  }

  async sendOrderReadyNotification(clientName, orderId, number) {
    const text = `Olá, *${clientName}*! Seu pedido da Sanpress (*#${orderId}*) está pronto para retirada. Você pode vir buscá-lo no balcão principal. Obrigado! 🖨️`;
    return this.sendMessage(number, text);
  }
}

const whatsappService = new WhatsAppService();
export default whatsappService;
