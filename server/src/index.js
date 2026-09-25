import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import whatsappService from './services/whatsappService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow local network connections from reception client PC
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

app.use(express.json());

// Bind API Routes
app.use('/api', routes);

// Serve downloaded WhatsApp media attachments statically
app.use('/media', express.static(path.resolve(__dirname, '../data/media')));

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'Sanpress Counter & Queue System API',
    time: new Date()
  });
});

// HTTP & WebSockets Server setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Share Socket.io instance with Express and services
app.set('io', io);
whatsappService.setSocketIO(io);

// Initialize background WhatsApp automation service
whatsappService.init();

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log(`[WebSocket] Cliente conectado ID: ${socket.id}`);
  
  // Send current WhatsApp status on connection
  socket.emit('whatsapp_status', whatsappService.getConnectionStatus());

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Cliente desconectado ID: ${socket.id}`);
  });
});

// Start listening
server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🚀 SERVIDOR SANPRESS ONLINE NA PORTA ${PORT}`);
  console.log(`👉 API Local: http://localhost:${PORT}`);
  console.log('==================================================');
});
