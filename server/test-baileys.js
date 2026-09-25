import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import qrcode from 'qrcode-terminal';
import { fileURLToPath } from 'url';

// Force IPv4 resolution
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testAuthPath = path.resolve(__dirname, './data/test-auth');

// Make sure cleanup is possible
console.log('==================================================');
console.log('   INICIANDO SCRIPT DE TESTE DE EVENTOS BAILEYS   ');
console.log(`   Sessão temporária em: ${testAuthPath}          `);
console.log('==================================================\n');

async function startTest() {
  const { state, saveCreds } = await useMultiFileAuthState(testAuthPath);
  
  let version = [2, 3000, 1015901307];
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
    console.log(`[Teste] Versão do WhatsApp Web obtida: ${version.join('.')}`);
  } catch (e) {
    console.log('[Teste] Usando versão de fallback.');
  }

  const initSocket = makeWASocket.default || makeWASocket;
  const sock = initSocket({
    version,
    auth: state,
    logger: pino({ level: 'warn' }), // Warn-level so we can see library warnings
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000
  });

  sock.ev.on('creds.update', saveCreds);

  // 1. Monitor connection status and output QR code to terminal
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('\n[Conexão] QR Code gerado! Escaneie abaixo:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`\n[Conexão] Conexão Fechada. Status: ${statusCode}`);
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('[Conexão] Reconectando em 5 segundos...');
        setTimeout(() => startTest(), 5000);
      }
    } else if (connection === 'open') {
      console.log('\n[Conexão] WhatsApp CONECTADO com sucesso!');
    }
  });

  // 2. Monitor messaging history sync (called when scanning QR code)
  sock.ev.on('messaging-history.set', (data) => {
    console.log('\n=========================================');
    console.log('👉 EVENTO DISPARADO: messaging-history.set');
    console.log(`   - Contatos recebidos: ${data.contacts?.length || 0}`);
    console.log(`   - Conversas recebidas: ${data.chats?.length || 0}`);
    console.log(`   - Mensagens recebidas: ${data.messages?.length || 0}`);
    console.log('=========================================');
    
    if (data.messages && data.messages.length > 0) {
      console.log('\nEstrutura de Exemplo de uma Mensagem no Histórico:');
      // Print first 2 messages to understand structure
      console.log(JSON.stringify(data.messages.slice(0, 2), null, 2));
    }
  });

  // 3. Monitor incremental chats events
  sock.ev.on('chats.set', (data) => {
    console.log(`\n[Evento] chats.set - Recebeu ${data.chats?.length || 0} chats.`);
  });

  sock.ev.on('chats.upsert', (chatsList) => {
    console.log(`\n[Evento] chats.upsert - Atualizou ${chatsList.length} chats.`);
  });

  // 4. Monitor incremental messages
  sock.ev.on('messages.set', (data) => {
    console.log(`\n[Evento] messages.set - Recebeu ${data.messages?.length || 0} mensagens.`);
  });

  // 5. Monitor real-time messages
  sock.ev.on('messages.upsert', (data) => {
    console.log(`\n[Evento] messages.upsert - Recebeu mensagem em tempo real.`);
    console.log(JSON.stringify(data.messages, null, 2));
  });

  // 6. Monitor contacts events
  sock.ev.on('contacts.set', (data) => {
    console.log(`\n[Evento] contacts.set - Sincronizou ${data.contacts?.length || 0} contatos.`);
  });
}

// Ensure qrcode-terminal is installed, otherwise warn
import { execSync } from 'child_process';
try {
  startTest();
} catch (err) {
  console.log('Instalando dependência temporária qrcode-terminal...');
  execSync('npm install qrcode-terminal', { cwd: __dirname });
  startTest();
}
