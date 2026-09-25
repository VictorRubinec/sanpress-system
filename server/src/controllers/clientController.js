import db from '../db/knex.js';

/**
 * Lists and filters clients.
 */
export async function getClients(req, res) {
  try {
    const { search } = req.query;
    let query = db('clientes');

    if (search) {
      query = query.where(function() {
        this.where('nome', 'like', `%${search}%`)
            .orWhere('whatsapp', 'like', `%${search}%`)
            .orWhere('ra', 'like', `%${search}%`)
            .orWhere('email', 'like', `%${search}%`);
      });
    }

    const clients = await query.orderBy('nome', 'asc').limit(30);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: `Erro ao buscar clientes: ${error.message}` });
  }
}

/**
 * Creates a new client.
 */
export async function createClient(req, res) {
  try {
    const { nome, whatsapp, email, tipo, ra, curso_matricula } = req.body;

    if (!nome || !whatsapp || !tipo) {
      return res.status(400).json({ error: 'Nome, WhatsApp e Tipo são campos obrigatórios.' });
    }

    if (tipo === 'Aluno' && !ra) {
      return res.status(400).json({ error: 'O RA é obrigatório para clientes do tipo Aluno.' });
    }

    // Sanitize WhatsApp number
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    // Check duplicate WhatsApp
    const existing = await db('clientes').where({ whatsapp: cleanWhatsapp }).first();
    if (existing) {
      return res.status(400).json({ error: 'Já existe um cliente cadastrado com este número de WhatsApp.' });
    }

    const [id] = await db('clientes').insert({
      nome,
      whatsapp: cleanWhatsapp,
      email: email || null,
      tipo,
      ra: tipo === 'Aluno' ? ra : null,
      curso_matricula: curso_matricula || null
    });

    const newClient = await db('clientes').where({ id }).first();
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ error: `Erro ao cadastrar cliente: ${error.message}` });
  }
}

/**
 * Updates an existing client's details.
 */
export async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const { nome, whatsapp, email, tipo, ra, curso_matricula } = req.body;

    if (!nome || !whatsapp || !tipo) {
      return res.status(400).json({ error: 'Nome, WhatsApp e Tipo são campos obrigatórios.' });
    }

    if (tipo === 'Aluno' && !ra) {
      return res.status(400).json({ error: 'O RA é obrigatório para clientes do tipo Aluno.' });
    }

    // Sanitize WhatsApp number
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    // Check duplicate WhatsApp for other clients
    const existing = await db('clientes')
      .where({ whatsapp: cleanWhatsapp })
      .andWhereNot({ id })
      .first();
    if (existing) {
      return res.status(400).json({ error: 'Já existe outro cliente cadastrado com este número de WhatsApp.' });
    }

    await db('clientes')
      .where({ id })
      .update({
        nome,
        whatsapp: cleanWhatsapp,
        email: email || null,
        tipo,
        ra: tipo === 'Aluno' ? ra : null,
        curso_matricula: curso_matricula || null
      });

    const updatedClient = await db('clientes').where({ id }).first();
    res.json(updatedClient);
  } catch (error) {
    res.status(500).json({ error: `Erro ao atualizar cliente: ${error.message}` });
  }
}

/**
 * Gets a client's order history and detailed stats.
 */
export async function getClientHistory(req, res) {
  try {
    const { id } = req.params;

    const client = await db('clientes').where({ id }).first();
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    const orders = await db('pedidos')
      .where({ cliente_id: id })
      .orderBy('created_at', 'desc');

    const orderIds = orders.map(o => o.id);
    let items = [];
    
    if (orderIds.length > 0) {
      items = await db('itens_pedido').whereIn('pedido_id', orderIds);
    }

    const fullHistory = orders.map(order => ({
      ...order,
      itens: items.filter(item => item.pedido_id === order.id)
    }));

    res.json({
      cliente: client,
      pedidos: fullHistory
    });
  } catch (error) {
    res.status(500).json({ error: `Erro ao carregar histórico: ${error.message}` });
  }
}
