import db from '../db/knex.js';
import whatsappService from '../services/whatsappService.js';
import QRCode from 'qrcode';

/**
 * Gets connection status. If QR Code is present, encodes it as base64 DataURL for direct <img> usage.
 */
export async function getStatus(req, res) {
  try {
    const state = whatsappService.getConnectionStatus();
    
    if (state.qr) {
      const qrDataUrl = await QRCode.toDataURL(state.qr, { width: 300, margin: 2 });
      return res.json({ status: state.status, qr: qrDataUrl });
    }
    
    res.json({ status: state.status, qr: null });
  } catch (error) {
    res.status(500).json({ error: `Erro ao obter status do WhatsApp: ${error.message}` });
  }
}

/**
 * Gets recent conversations list. Resolves contact numbers to registered client names if available.
 */
export async function getChats(req, res) {
  try {
    // Group messages by contact and find last message timestamp
    const chats = await db('mensagens_whatsapp')
      .select('contato_whatsapp')
      .max('timestamp as last_timestamp')
      .groupBy('contato_whatsapp');

    const chatDetails = [];
    
    for (const chat of chats) {
      const lastMsg = await db('mensagens_whatsapp')
        .where({ contato_whatsapp: chat.contato_whatsapp })
        .orderBy('timestamp', 'desc')
        .first();

      // Check if number belongs to a client
      const client = await db('clientes').where({ whatsapp: chat.contato_whatsapp }).first();

      // Resolve JID for profile picture lookup
      const phone = chat.contato_whatsapp;
      const lidJid = whatsappService.getLidForPhone(phone);
      const targetJid = lidJid || `${phone}@s.whatsapp.net`;
      const fotoUrl = await whatsappService.getProfilePictureUrl(targetJid);

      chatDetails.push({
        contato_whatsapp: chat.contato_whatsapp,
        cliente_nome: client ? client.nome : `+${chat.contato_whatsapp}`,
        cliente_tipo: client ? client.tipo : 'Externo',
        ultimo_texto: lastMsg.mensagem,
        timestamp: lastMsg.timestamp,
        direcao: lastMsg.direcao,
        foto_url: fotoUrl || null
      });
    }

    // Sort by recent activity
    chatDetails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(chatDetails);
  } catch (error) {
    res.status(500).json({ error: `Erro ao buscar conversas: ${error.message}` });
  }
}

/**
 * Retrieves the full message logs for a single contact thread.
 */
export async function getMessages(req, res) {
  try {
    const { contact } = req.params;

    if (!contact) {
      return res.status(400).json({ error: 'Contato é obrigatório.' });
    }

    const messages = await db('mensagens_whatsapp')
      .where({ contato_whatsapp: contact })
      .orderBy('timestamp', 'asc');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: `Erro ao buscar mensagens: ${error.message}` });
  }
}

/**
 * Dispatches an outgoing message.
 */
export async function sendMessage(req, res) {
  try {
    const { contact, message } = req.body;

    if (!contact || !message) {
      return res.status(400).json({ error: 'Contato e mensagem são campos obrigatórios.' });
    }

    const sentMessage = await whatsappService.sendMessage(contact, message);
    res.status(201).json(sentMessage);
  } catch (error) {
    res.status(500).json({ error: `Erro ao enviar mensagem de WhatsApp: ${error.message}` });
  }
}

/**
 * Log out and disconnect WhatsApp connection, erasing session files and message logs.
 */
export async function disconnect(req, res) {
  try {
    await whatsappService.disconnect();
    res.json({ message: 'Sessão encerrada com sucesso e mensagens limpas.' });
  } catch (error) {
    res.status(500).json({ error: `Erro ao desconectar WhatsApp: ${error.message}` });
  }
}
