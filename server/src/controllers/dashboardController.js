import db from '../db/knex.js';

/**
 * Compiles all statistical data and metrics for the management dashboard.
 */
export async function getStats(req, res) {
  try {
    // 1. General indicators for today vs current month
    const totalStats = await db('pedidos')
      .select(
        db.raw("SUM(CASE WHEN date(created_at) = date('now') THEN total ELSE 0 END) as faturamento_hoje"),
        db.raw("COUNT(CASE WHEN date(created_at) = date('now') THEN 1 END) as pedidos_hoje"),
        db.raw("SUM(CASE WHEN strftime('%m', created_at) = strftime('%m', 'now') THEN total ELSE 0 END) as faturamento_mes"),
        db.raw("COUNT(CASE WHEN strftime('%m', created_at) = strftime('%m', 'now') THEN 1 END) as pedidos_mes")
      ).first();

    // 2. Daily revenue in the last 30 days
    const dailyBilling = await db('pedidos')
      .select(db.raw("date(created_at) as data"), db.raw("SUM(total) as faturamento"))
      .whereRaw("created_at >= date('now', '-30 days')")
      .groupByRaw("date(created_at)")
      .orderBy('data', 'asc');

    // 3. Payment methods distribution
    const paymentDistribution = await db('pedidos')
      .select('forma_pagamento')
      .count('id as quantidade')
      .sum('total as total')
      .whereNotNull('forma_pagamento')
      .groupBy('forma_pagamento');

    // 4. Sales volumes by customer type
    const clientTypeDistribution = await db('pedidos')
      .join('clientes', 'pedidos.cliente_id', '=', 'clientes.id')
      .select('clientes.tipo')
      .count('pedidos.id as quantidade')
      .sum('pedidos.total as total')
      .groupBy('clientes.tipo');

    // 5. Operation peak times (order volumes by hour of day)
    const peakHours = await db('pedidos')
      .select(db.raw("strftime('%H', created_at) as hora"))
      .count('id as quantidade')
      .groupByRaw("strftime('%H', created_at)")
      .orderBy('hora', 'asc');

    res.json({
      resumo: {
        faturamento_hoje: totalStats?.faturamento_hoje || 0,
        pedidos_hoje: totalStats?.pedidos_hoje || 0,
        faturamento_mes: totalStats?.faturamento_mes || 0,
        pedidos_mes: totalStats?.pedidos_mes || 0
      },
      faturamento_diario: dailyBilling.map(d => ({
        data: d.data.split('-').reverse().slice(0, 2).join('/'), // Convert YYYY-MM-DD to DD/MM
        faturamento: Number(d.faturamento || 0)
      })),
      distribuicao_pagamento: paymentDistribution.map(p => ({
        name: p.forma_pagamento,
        value: Number(p.total || 0),
        quantidade: p.quantidade
      })),
      distribuicao_cliente: clientTypeDistribution.map(c => ({
        name: c.tipo,
        value: Number(c.total || 0),
        quantidade: c.quantidade
      })),
      horarios_pico: peakHours.map(h => ({
        hora: `${h.hora}:00`,
        quantidade: h.quantidade
      }))
    });
  } catch (error) {
    res.status(500).json({ error: `Erro ao carregar dados do dashboard: ${error.message}` });
  }
}
