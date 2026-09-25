export async function seed(knex) {
  // Deletes ALL existing entries
  await knex('mensagens_whatsapp').del();
  await knex('itens_pedido').del();
  await knex('pedidos').del();
  await knex('clientes').del();

  // Insert clients with explicit IDs to establish clean relations
  await knex('clientes').insert([
    {
      id: 1,
      nome: 'Victor Hugo da Silva',
      whatsapp: '5511924531622',
      email: 'victor.hugo@universidade.edu',
      tipo: 'Aluno',
      ra: '2204593',
      curso_matricula: 'Engenharia de Computação',
      created_at: knex.raw("datetime('now', '-5 days')")
    },
    {
      id: 2,
      nome: 'Prof. Ana Maria Abreu',
      whatsapp: '5511988887777',
      email: 'ana.abreu@universidade.edu',
      tipo: 'Professor',
      ra: null,
      curso_matricula: 'Departamento de Física',
      created_at: knex.raw("datetime('now', '-10 days')")
    },
    {
      id: 3,
      nome: 'Juliana Mendes (Papelaria Criativa)',
      whatsapp: '5511999998888',
      email: 'contato@papelariacriativa.com',
      tipo: 'Externo',
      ra: null,
      curso_matricula: null,
      created_at: knex.raw("datetime('now', '-2 days')")
    }
  ]);

  // Insert orders with explicit IDs
  await knex('pedidos').insert([
    {
      id: 1,
      cliente_id: 1,
      status: 'Concluído / Entregue',
      forma_pagamento: 'Pix',
      total: 35.00,
      caminho_arquivo: 'c:/Users/Victor/Desktop/Códigos/Sanpress/Compartilhado/Apostila_Calculo1.pdf',
      created_at: knex.raw("datetime('now', '-4 days')")
    },
    {
      id: 2,
      cliente_id: 1,
      status: 'Pronto para Retirada',
      forma_pagamento: 'Cartão Crédito',
      total: 12.50,
      caminho_arquivo: 'c:/Users/Victor/Desktop/Códigos/Sanpress/Compartilhado/Poster_Cientifico_A3.pdf',
      created_at: knex.raw("datetime('now', '-1 hours')")
    },
    {
      id: 3,
      cliente_id: 2,
      status: 'Em Impressão',
      forma_pagamento: 'Pix',
      total: 120.00,
      caminho_arquivo: 'c:/Users/Victor/Desktop/Códigos/Sanpress/Compartilhado/Provas_Fisica_Geral.pdf',
      created_at: knex.raw("datetime('now', '-30 minutes')")
    },
    {
      id: 4,
      cliente_id: 3,
      status: 'Na Fila / A Imprimir',
      forma_pagamento: 'Dinheiro',
      total: 45.00,
      caminho_arquivo: 'c:/Users/Victor/Desktop/Códigos/Sanpress/Compartilhado/Cartoes_Visita_Juliana.pdf',
      created_at: knex.raw("datetime('now', '-10 minutes')")
    },
    {
      id: 5,
      cliente_id: 1,
      status: 'Aguardando Pagamento',
      forma_pagamento: null,
      total: 8.00,
      caminho_arquivo: 'c:/Users/Victor/Desktop/Códigos/Sanpress/Compartilhado/Trabalho_Algoritmos.pdf',
      created_at: knex.raw("datetime('now')")
    }
  ]);

  // Insert items
  await knex('itens_pedido').insert([
    // Order 1 items
    { id: 1, pedido_id: 1, descricao: 'Encadernação Espiral A4 - Capa Preta', quantidade: 1, valor_unitario: 10.00 },
    { id: 2, pedido_id: 1, descricao: 'Impressão Preto e Branco (Frente e Verso)', quantidade: 100, valor_unitario: 0.25 },
    
    // Order 2 items
    { id: 3, pedido_id: 2, descricao: 'Impressão Colorida Laser Papel Couchê A3', quantidade: 1, valor_unitario: 12.50 },

    // Order 3 items
    { id: 4, pedido_id: 3, descricao: 'Impressão Prova A4 (Dupla Face) Gramatura 90g', quantidade: 400, valor_unitario: 0.30 },

    // Order 4 items
    { id: 5, pedido_id: 4, descricao: 'Cartão de Visita 250g Verniz Total Frente (Cento)', quantidade: 1, valor_unitario: 45.00 },

    // Order 5 items
    { id: 6, pedido_id: 5, descricao: 'Impressão Colorida A4 Papel Sulfite', quantidade: 4, valor_unitario: 2.00 }
  ]);


}
