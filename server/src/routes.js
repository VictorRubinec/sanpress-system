import express from 'express';
import * as clientController from './controllers/clientController.js';
import * as orderController from './controllers/orderController.js';
import * as whatsappController from './controllers/whatsappController.js';
import * as dashboardController from './controllers/dashboardController.js';

const router = express.Router();

// Clients Routes
router.get('/clientes', clientController.getClients);
router.post('/clientes', clientController.createClient);
router.put('/clientes/:id', clientController.updateClient);
router.get('/clientes/:id/historico', clientController.getClientHistory);

// Orders / Production Queue Routes
router.get('/pedidos/historico', orderController.getOrderHistory);
router.get('/pedidos', orderController.getActiveQueue);
router.post('/pedidos', orderController.createOrder);
router.patch('/pedidos/:id/status', orderController.updateStatus);
router.put('/pedidos/:id/itens', orderController.updateOrderItems);
router.post('/pedidos/:id/abrir-arquivo', orderController.openFile);

// WhatsApp Automations & Console Routes
router.get('/whatsapp/status', whatsappController.getStatus);
router.get('/whatsapp/conversas', whatsappController.getChats);
router.get('/whatsapp/conversas/:contact', whatsappController.getMessages);
router.post('/whatsapp/enviar', whatsappController.sendMessage);
router.post('/whatsapp/desconectar', whatsappController.disconnect);

// Dashboard Analytics Routes
router.get('/dashboard/stats', dashboardController.getStats);

export default router;
