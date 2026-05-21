const db = require('../database/db');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class Payments {
  static async criarPagamentoPIX(usuarioId, planoId, cupomId = null) {
    try {
      const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [usuarioId]);
      const plano = await db.get('SELECT * FROM planos WHERE id = ?', [planoId]);

      if (!usuario || !plano) {
        return { sucesso: false, mensagem: 'Usuário ou plano não encontrado' };
      }

      let desconto = 0;
      if (cupomId) {
        const cupom = await db.get('SELECT * FROM cupons WHERE id = ? AND ativo = 1', [cupomId]);
        if (cupom && cupom.usado < cupom.limite_uso) {
          desconto = cupom.tipo_desconto === 'percentual' 
            ? (plano.preco * cupom.valor_desconto) / 100 
            : cupom.valor_desconto;
        }
      }

      const valorFinal = Math.max(plano.preco - desconto, 0);
      const referenciaPIX = uuidv4().replace(/-/g, '').substring(0, 32);
      const chaveQRCode = `00020126580014br.bcb.brcode01051.0.0463047B7E0A1051.0662${referenciaPIX}5204000053039865406${valorFinal.toFixed(2)}5802BR5913VENDAS IPTV6009SAO PAULO62410503***630414A1`;

      const qrCodeData = await QRCode.toDataURL(chaveQRCode);

      const pagamento = await db.run(`
        INSERT INTO pagamentos (usuario_id, plano_id, valor, referencia_pix, qr_code, status, tipo_pagamento, cupom_id, desconto, valor_final)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [usuarioId, planoId, plano.preco, referenciaPIX, qrCodeData, 'pendente', 'pix', cupomId, desconto, valorFinal]);

      return {
        sucesso: true,
        pagamento: {
          id: pagamento.lastID,
          usuario_id: usuarioId,
          plano_id: planoId,
          valor: plano.preco,
          desconto: desconto,
          valor_final: valorFinal,
          referencia_pix: referenciaPIX,
          qr_code: qrCodeData,
          status: 'pendente'
        }
      };
    } catch (error) {
      console.error('Erro ao criar pagamento PIX:', error);
      return { sucesso: false, mensagem: 'Erro ao criar pagamento' };
    }
  }

  static async confirmarPagamento(pagamentoId) {
    try {
      const pagamento = await db.get('SELECT * FROM pagamentos WHERE id = ?', [pagamentoId]);

      if (!pagamento) {
        return { sucesso: false, mensagem: 'Pagamento não encontrado' };
      }

      await db.run(
        'UPDATE pagamentos SET status = ?, pago_em = CURRENT_TIMESTAMP WHERE id = ?',
        ['confirmado', pagamentoId]
      );

      // Criar assinatura
      const dataInicio = new Date();
      const dataExpiracao = new Date(dataInicio.getTime() + (30 * 24 * 60 * 60 * 1000));
      const chaveAcesso = uuidv4();

      await db.run(`
        INSERT INTO assinaturas (usuario_id, plano_id, data_expiracao, chave_acesso, status)
        VALUES (?, ?, ?, ?, ?)
      `, [pagamento.usuario_id, pagamento.plano_id, dataExpiracao.toISOString(), chaveAcesso, 'ativa']);

      // Atualizar cupom se usado
      if (pagamento.cupom_id) {
        await db.run(
          'UPDATE cupons SET usado = usado + 1 WHERE id = ?',
          [pagamento.cupom_id]
        );
      }

      return { sucesso: true, mensagem: 'Pagamento confirmado e assinatura ativada' };
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      return { sucesso: false, mensagem: 'Erro ao confirmar pagamento' };
    }
  }

  static async obterPagamentos(usuarioId = null, status = null) {
    try {
      let sql = 'SELECT * FROM pagamentos WHERE 1=1';
      let params = [];

      if (usuarioId) {
        sql += ' AND usuario_id = ?';
        params.push(usuarioId);
      }

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY criado_em DESC LIMIT 100';
      const pagamentos = await db.all(sql, params);
      return pagamentos;
    } catch (error) {
      console.error('Erro ao obter pagamentos:', error);
      return [];
    }
  }

  static async obterPagamento(pagamentoId) {
    try {
      const pagamento = await db.get('SELECT * FROM pagamentos WHERE id = ?', [pagamentoId]);
      return pagamento;
    } catch (error) {
      console.error('Erro ao obter pagamento:', error);
      return null;
    }
  }

  static async cancelarPagamento(pagamentoId) {
    try {
      await db.run('UPDATE pagamentos SET status = ? WHERE id = ?', ['cancelado', pagamentoId]);
      return { sucesso: true, mensagem: 'Pagamento cancelado' };
    } catch (error) {
      console.error('Erro ao cancelar pagamento:', error);
      return { sucesso: false, mensagem: 'Erro ao cancelar pagamento' };
    }
  }
}

module.exports = Payments;
