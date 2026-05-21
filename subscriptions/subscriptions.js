const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Subscriptions {
  static async obterAssinaturaUsuario(usuarioId) {
    try {
      const assinatura = await db.get(`
        SELECT a.*, p.nome as plano_nome, p.preco, p.duracao_dias, p.max_dispositivos, p.qualidade
        FROM assinaturas a
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE a.usuario_id = ? AND a.status = 'ativa'
        ORDER BY a.data_expiracao DESC
        LIMIT 1
      `, [usuarioId]);
      return assinatura;
    } catch (error) {
      console.error('Erro ao obter assinatura:', error);
      return null;
    }
  }

  static async verificarAssinatura(usuarioId) {
    try {
      const assinatura = await this.obterAssinaturaUsuario(usuarioId);
      
      if (!assinatura) {
        return { ativo: false, mensagem: 'Sem assinatura ativa' };
      }

      const dataExpiracao = new Date(assinatura.data_expiracao);
      const agora = new Date();

      if (dataExpiracao < agora) {
        await db.run('UPDATE assinaturas SET status = ? WHERE id = ?', ['expirada', assinatura.id]);
        return { ativo: false, mensagem: 'Assinatura expirada' };
      }

      const diasRestantes = Math.ceil((dataExpiracao - agora) / (1000 * 60 * 60 * 24));

      return {
        ativo: true,
        plano: assinatura.plano_nome,
        dias_restantes: diasRestantes,
        data_expiracao: assinatura.data_expiracao,
        chave_acesso: assinatura.chave_acesso,
        max_dispositivos: assinatura.max_dispositivos,
        qualidade: assinatura.qualidade
      };
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      return { ativo: false, mensagem: 'Erro ao verificar' };
    }
  }

  static async criarAssinatura(usuarioId, planoId, duracao = 30) {
    try {
      const dataInicio = new Date();
      const dataExpiracao = new Date(dataInicio.getTime() + (duracao * 24 * 60 * 60 * 1000));
      const chaveAcesso = uuidv4();

      const assinatura = await db.run(`
        INSERT INTO assinaturas (usuario_id, plano_id, data_expiracao, chave_acesso, status)
        VALUES (?, ?, ?, ?, ?)
      `, [usuarioId, planoId, dataExpiracao.toISOString(), chaveAcesso, 'ativa']);

      return {
        sucesso: true,
        assinatura: {
          id: assinatura.lastID,
          usuario_id: usuarioId,
          plano_id: planoId,
          data_expiracao: dataExpiracao.toISOString(),
          chave_acesso: chaveAcesso,
          status: 'ativa'
        }
      };
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      return { sucesso: false, mensagem: 'Erro ao criar assinatura' };
    }
  }

  static async renovarAssinatura(usuarioId, planoId) {
    try {
      const assinatura = await this.obterAssinaturaUsuario(usuarioId);
      
      if (assinatura) {
        const plano = await db.get('SELECT * FROM planos WHERE id = ?', [planoId]);
        const novaDataExpiracao = new Date(assinatura.data_expiracao);
        novaDataExpiracao.setDate(novaDataExpiracao.getDate() + plano.duracao_dias);

        await db.run(
          'UPDATE assinaturas SET data_expiracao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
          [novaDataExpiracao.toISOString(), assinatura.id]
        );

        return { sucesso: true, mensagem: 'Assinatura renovada' };
      } else {
        return this.criarAssinatura(usuarioId, planoId);
      }
    } catch (error) {
      console.error('Erro ao renovar assinatura:', error);
      return { sucesso: false, mensagem: 'Erro ao renovar assinatura' };
    }
  }

  static async cancelarAssinatura(usuarioId) {
    try {
      await db.run(
        'UPDATE assinaturas SET status = ? WHERE usuario_id = ? AND status = ?',
        ['cancelada', usuarioId, 'ativa']
      );
      return { sucesso: true, mensagem: 'Assinatura cancelada' };
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      return { sucesso: false, mensagem: 'Erro ao cancelar assinatura' };
    }
  }

  static async obterTodasAsAssinaturas(status = null) {
    try {
      let sql = `
        SELECT a.*, u.primeiro_nome, u.username, p.nome as plano_nome
        FROM assinaturas a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE 1=1
      `;
      let params = [];

      if (status) {
        sql += ' AND a.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY a.criado_em DESC LIMIT 500';
      const assinaturas = await db.all(sql, params);
      return assinaturas;
    } catch (error) {
      console.error('Erro ao obter assinaturas:', error);
      return [];
    }
  }
}

module.exports = Subscriptions;
