import db from '../db/knex.js';
import terminalService from '../services/cardTerminalService.js';
import whatsappService from '../services/whatsappService.js';
import { openFileLocally } from '../services/fileService.js';

/**
 * Lists all active queue orders (status != Concluído / Entregue) joined with client details.
 */
export async function getActiveQueue(req, res) {
  try {
    const orders = await db('pedidos')
      .join('clientes', 'pedidos.cliente_id', '=', 'clientes.id')
      .select(
        'pedidos.*',
        'clientes.nome as cliente_nome',
        'clientes.whatsapp as cliente_whatsapp',
        'clientes.tipo as cliente_tipo',
        'clientes.ra as cliente_ra'
      )
      .whereNotIn('pedidos.status', ['Concluído / Entregue', 'Cancelado'])
      .orderBy('pedidos.created_at', 'asc');

    // Retrieve items for each order
    const orderIds = orders.map(o => o.id);
    let items = [];
    if (orderIds.length > 0) {
      items = await db('itens_pedido').whereIn('pedido_id', orderIds);
    }

    const queue = orders.map(order => ({
      ...order,
      itens: items.filter(item => item.pedido_id === order.id)
    }));

    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: `Erro ao obter fila de produção: ${error.message}` });
  }
}

/**
 * Creates a new order (Checkout). Handles payment integration and triggers real-time socket events.
 */
export async function createOrder(req, res) {
  let transaction;
  try {
    const { cliente_id, forma_pagamento, total, caminho_arquivo, itens, status_inicial } = req.body;

    if (!cliente_id || !itens || itens.length === 0 || total === undefined) {
      return res.status(400).json({ error: 'Dados insuficientes para fechar o pedido.' });
    }

    const client = await db('clientes').where({ id: cliente_id }).first();
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    let initialStatus = status_inicial || 'Na Fila / A Imprimir';

    // If payment method is a Card, interact with the Stone POS Terminal first
    if (forma_pagamento === 'Cartão Crédito' || forma_pagamento === 'Cartão Débito') {
      try {
        console.log(`[Checkout] Iniciando transação Stone de R$ ${total} via ${forma_pagamento}...`);
        const paymentResult = await terminalService.processPayment(Number(total), forma_pagamento);
        
        if (!paymentResult.success) {
          return res.status(400).json({
            error: `Pagamento recusado: ${paymentResult.message || 'Erro desconhecido'}`
          });
        }
        console.log(`[Checkout] Transação aprovada! ID: ${paymentResult.transactionId}`);
        initialStatus = 'Na Fila / A Imprimir'; // Payment is confirmed, so it goes straight to the queue
      } catch (err) {
        return res.status(502).json({ error: `Erro na integração com a maquininha: ${err.message}` });
      }
    }

    // Start database transaction
    transaction = await db.transaction();

    const [pedido_id] = await transaction('pedidos').insert({
      cliente_id,
      status: initialStatus,
      forma_pagamento: forma_pagamento || null,
      total,
      caminho_arquivo: caminho_arquivo || null
    });

    // Bulk insert order items
    const formattedItems = itens.map(item => ({
      pedido_id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario
    }));

    await transaction('itens_pedido').insert(formattedItems);

    await transaction.commit();

    // Fetch the full order details for WebSockets broadcast
    const createdOrder = await db('pedidos')
      .join('clientes', 'pedidos.cliente_id', '=', 'clientes.id')
      .select(
        'pedidos.*',
        'clientes.nome as cliente_nome',
        'clientes.whatsapp as cliente_whatsapp',
        'clientes.tipo as cliente_tipo'
      )
      .where('pedidos.id', pedido_id)
      .first();

    createdOrder.itens = formattedItems;

    // Notify clients via WebSocket in real-time
    const io = req.app.get('io');
    if (io) {
      io.emit('pedido_criado', createdOrder);
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: `Erro ao processar pedido: ${error.message}` });
  }
}

/**
 * Updates status of an order. Fires automated WhatsApp alert when marked as 'Pronto para Retirada'.
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, cancelDetails } = req.body;

    const validStatuses = [
      'Aguardando Pagamento',
      'Na Fila / A Imprimir',
      'Em Impressão',
      'Pronto para Retirada',
      'Concluído / Entregue',
      'Cancelado'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status de pedido inválido.' });
    }

    const order = await db('pedidos').where({ id }).first();
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    await db('pedidos').where({ id }).update({ status });

    if (status === 'Cancelado' && cancelDetails) {
      const { motivo, produzido, pago, devolvido } = cancelDetails;
      await db('itens_pedido').insert({
        pedido_id: id,
        descricao: `[CANCELAMENTO] Motivo: ${motivo} | Produzido: ${produzido} | Pago: ${pago} | Devolvido: ${devolvido}`,
        quantidade: 1,
        valor_unitario: 0.00
      });
    }

    const client = await db('clientes').where({ id: order.cliente_id }).first();

    // Notify WebSockets about the update
    const io = req.app.get('io');
    if (io) {
      io.emit('pedido_atualizado', { id: Number(id), status });
    }

    // Trigger WhatsApp notification if status changed to 'Pronto para Retirada'
    if (status === 'Pronto para Retirada' && client) {
      try {
        console.log(`[Auto-Whats] Disparando notificação de retirada para ${client.nome}...`);
        await whatsappService.sendOrderReadyNotification(client.nome, id, client.whatsapp);
      } catch (err) {
        console.error(`[Auto-Whats] Falha ao enviar notificação de WhatsApp: ${err.message}`);
      }
    }

    res.json({ message: 'Status atualizado com sucesso.', status });
  } catch (error) {
    res.status(500).json({ error: `Erro ao atualizar status: ${error.message}` });
  }
}

/**
 * Triggers host OS to open the file bound to the order.
 */
export async function openFile(req, res) {
  try {
    const { id } = req.params;
    const order = await db('pedidos').where({ id }).first();

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    if (!order.caminho_arquivo) {
      return res.status(400).json({ error: 'Este pedido não possui arquivo associado.' });
    }

    console.log(`[FileOpen] Solicitando abertura local de: ${order.caminho_arquivo}`);
    await openFileLocally(order.caminho_arquivo);

    res.json({ message: 'Arquivo aberto com sucesso no PC Principal.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Lists all orders (history: including completed and cancelled ones) joined with client details.
 */
export async function getOrderHistory(req, res) {
  try {
    const orders = await db('pedidos')
      .join('clientes', 'pedidos.cliente_id', '=', 'clientes.id')
      .select(
        'pedidos.*',
        'clientes.nome as cliente_nome',
        'clientes.whatsapp as cliente_whatsapp',
        'clientes.tipo as cliente_tipo',
        'clientes.ra as cliente_ra'
      )
      .orderBy('pedidos.created_at', 'desc');

    // Retrieve items for each order
    const orderIds = orders.map(o => o.id);
    let items = [];
    if (orderIds.length > 0) {
      items = await db('itens_pedido').whereIn('pedido_id', orderIds);
    }

    const history = orders.map(order => ({
      ...order,
      itens: items.filter(item => item.pedido_id === order.id)
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: `Erro ao obter histórico de pedidos: ${error.message}` });
  }
}

/**
 * Updates the items of an order, recalculates the order total, and updates the order record.
 */
export async function updateOrderItems(req, res) {
  const { id } = req.params;
  const { items } = req.body; // Array of items: [{ id, descricao, quantidade, valor_unitario }]

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Lista de itens inválida.' });
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Get original items to keep metadata items (description starts with '[')
      const originalItems = await trx('itens_pedido').where({ pedido_id: id });
      const metadataItems = originalItems.filter(item => item.descricao.startsWith('['));

      // 2. Clear all items for this order
      await trx('itens_pedido').where({ pedido_id: id }).del();

      // 3. Re-insert metadata items
      if (metadataItems.length > 0) {
        await trx('itens_pedido').insert(
          metadataItems.map(item => ({
            pedido_id: id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario
          }))
        );
      }

      // 4. Insert new user-added items
      const userItems = items.filter(item => !item.descricao.startsWith('['));
      if (userItems.length > 0) {
        await trx('itens_pedido').insert(
          userItems.map(item => ({
            pedido_id: id,
            descricao: item.descricao,
            quantidade: Number(item.quantidade) || 1,
            valor_unitario: Number(item.valor_unitario) || 0
          }))
        );
      }

      // 5. Recalculate order total
      const allItems = await trx('itens_pedido').where({ pedido_id: id });
      const total = allItems.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);

      // 6. Update order total
      await trx('pedidos').where({ id }).update({ total });

      // Retrieve the updated order to return
      const updatedOrder = await trx('pedidos').where({ id }).first();

      // Broadcast changes via socket
      const io = req.app.get('io');
      if (io) {
        io.emit('pedido_atualizado', { id: Number(id), status: updatedOrder.status });
      }
    });

    res.json({ message: 'Itens do pedido atualizados com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: `Erro ao atualizar itens do pedido: ${error.message}` });
  }
}
