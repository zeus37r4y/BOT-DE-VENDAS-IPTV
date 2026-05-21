const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'vendas.db');
const db = new sqlite3.Database(dbPath);

const criarTabelas = () => {
  db.serialize(() => {
    // Tabela de Usuários
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        primeiro_nome TEXT,
        ultimo_nome TEXT,
        email TEXT,
        telefone TEXT,
        status TEXT DEFAULT 'ativo',
        bloqueado INTEGER DEFAULT 0,
        vip INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Planos
    db.run(`
      CREATE TABLE IF NOT EXISTS planos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL,
        duracao_dias INTEGER DEFAULT 30,
        max_dispositivos INTEGER DEFAULT 1,
        qualidade TEXT DEFAULT 'full_hd',
        ativo INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Assinaturas
    db.run(`
      CREATE TABLE IF NOT EXISTS assinaturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        plano_id INTEGER NOT NULL,
        data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_expiracao DATETIME NOT NULL,
        status TEXT DEFAULT 'ativa',
        chave_acesso TEXT UNIQUE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(plano_id) REFERENCES planos(id)
      )
    `);

    // Tabela de Pagamentos
    db.run(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        plano_id INTEGER NOT NULL,
        valor REAL NOT NULL,
        tipo_pagamento TEXT DEFAULT 'pix',
        referencia_pix TEXT,
        qr_code TEXT,
        status TEXT DEFAULT 'pendente',
        metodo TEXT,
        transacao_id TEXT UNIQUE,
        cupom_id INTEGER,
        desconto REAL DEFAULT 0,
        valor_final REAL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        pago_em DATETIME,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(plano_id) REFERENCES planos(id),
        FOREIGN KEY(cupom_id) REFERENCES cupons(id)
      )
    `);

    // Tabela de Cupons
    db.run(`
      CREATE TABLE IF NOT EXISTS cupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        tipo_desconto TEXT DEFAULT 'percentual',
        valor_desconto REAL NOT NULL,
        limite_uso INTEGER,
        usado INTEGER DEFAULT 0,
        ativo INTEGER DEFAULT 1,
        data_inicio DATETIME,
        data_expiracao DATETIME,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Admin
    db.run(`
      CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        email TEXT UNIQUE,
        nome TEXT,
        permissoes TEXT DEFAULT 'full',
        ativo INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Broadcasts
    db.run(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT,
        mensagem TEXT NOT NULL,
        status TEXT DEFAULT 'rascunho',
        total INTEGER DEFAULT 0,
        enviados INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        enviado_em DATETIME,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Notificações
    db.run(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        titulo TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        tipo TEXT DEFAULT 'info',
        lido INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
      )
    `);

    // Tabela de Logs
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        tipo TEXT NOT NULL,
        acao TEXT NOT NULL,
        detalhes TEXT,
        ip TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
      )
    `);

    // Tabela de Configurações
    db.run(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chave TEXT UNIQUE NOT NULL,
        valor TEXT,
        tipo TEXT DEFAULT 'string',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Suporte
    db.run(`
      CREATE TABLE IF NOT EXISTS suporte (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        status TEXT DEFAULT 'aberto',
        resposta TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        respondido_em DATETIME,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
      )
    `);
  });

  // Inserir planos padrão
  setTimeout(() => {
    db.run(`
      INSERT OR IGNORE INTO planos (nome, descricao, preco, duracao_dias, max_dispositivos, qualidade)
      VALUES 
        ('BÁSICO', 'Plano básico com qualidade Full HD', 19.99, 30, 1, 'full_hd'),
        ('PREMIUM', 'Plano premium com qualidade 4K', 39.99, 30, 2, '4k'),
        ('VIP', 'Plano VIP com acesso total', 79.99, 30, 4, '4k')
    `);
  }, 500);

  // Inserir admin padrão (senha: admin123)
  setTimeout(() => {
    const bcrypt = require('bcryptjs');
    const senha = bcrypt.hashSync('admin123', 10);
    db.run(`
      INSERT OR IGNORE INTO admin (username, senha, email, nome, permissoes, ativo)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['admin', senha, 'admin@bot.com', 'Administrador', 'full', 1]);
  }, 500);

  console.log('✅ Tabelas criadas com sucesso!');
  console.log('📊 Banco de dados iniciado em:', dbPath);
  
  setTimeout(() => {
    db.close();
    console.log('✅ Banco de dados pronto para usar!\n');
    console.log('🚀 PRÓXIMO PASSO: npm start\n');
  }, 1000);
};

criarTabelas();
