export function up(knex) {
  return knex.schema
    .createTable('clientes', (table) => {
      table.increments('id').primary();
      table.string('nome').notNullable().index();
      table.string('whatsapp').notNullable().index();
      table.string('email');
      table.string('tipo').notNullable(); // Aluno, Professor, Externo
      table.string('ra');
      table.string('curso_matricula');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('pedidos', (table) => {
      table.increments('id').primary();
      table.integer('cliente_id').unsigned().notNullable()
        .references('id').inTable('clientes').onDelete('CASCADE');
      table.string('status').notNullable(); // Aguardando Pagamento, Na Fila / A Imprimir, Em Impressão, Pronto para Retirada, Concluído / Entregue
      table.string('forma_pagamento'); // Pix, Dinheiro, Cartão Crédito, Cartão Débito
      table.decimal('total', 10, 2).notNullable();
      table.text('caminho_arquivo');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('itens_pedido', (table) => {
      table.increments('id').primary();
      table.integer('pedido_id').unsigned().notNullable()
        .references('id').inTable('pedidos').onDelete('CASCADE');
      table.string('descricao').notNullable();
      table.integer('quantidade').notNullable();
      table.decimal('valor_unitario', 10, 2).notNullable();
    })
    .createTable('mensagens_whatsapp', (table) => {
      table.increments('id').primary();
      table.string('contato_whatsapp').notNullable().index();
      table.text('mensagem').notNullable();
      table.string('direcao').notNullable(); // inbound, outbound
      table.timestamp('timestamp').defaultTo(knex.fn.now());
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('mensagens_whatsapp')
    .dropTableIfExists('itens_pedido')
    .dropTableIfExists('pedidos')
    .dropTableIfExists('clientes');
}
