const db = require('../database/db');

class Subscriptions {
  static async obterAssinatura(userId) {
    try {
      const assinatura = await db.get(`
        SELECT 
          a.*,
          p.nome as plano_nome,
          p.descricao,
          p.preco,
          p.canais,
          p.qualidade
        FROM assinaturas a
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE a.user_id = ? AND a.status = 'ativa'
        ORDER BY a.data_inicio DESC
        LIMIT 1
      `, [userId]);

      return assinatura;
    } catch (error) {
      console.error('Erro ao obter assinatura:', error);
      return null;
    }
  }

  static async obterAssinaturas(userId) {
    try {
      const assinaturas = await db.all(`
        SELECT 
          a.*,
          p.nome as plano_nome,
          p.preco
        FROM assinaturas a
        LEFT JOIN planos p ON a.plano_id = p.id
        WHERE a.user_id = ?
        ORDER BY a.data_inicio DESC
      `, [userId]);

      return assinaturas;
    } catch (error) {
      console.error('Erro ao obter assinaturas:', error);
      return [];
    }
  }

  static async verificarAssinatura(userId) {
    try {
      const assinatura = await db.get(`
        SELECT * FROM assinaturas 
        WHERE user_id = ? AND status = 'ativa' AND data_expiracao > CURRENT_TIMESTAMP
        LIMIT 1
      `, [userId]);

      return !!assinatura;
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      return false;
    }
  }

  static async renovarAssinatura(userId, planoId) {
    try {
      const plano = await db.get('SELECT duracao_dias FROM planos WHERE id = ?', [planoId]);

      if (!plano) {
        return { sucesso: false, mensagem: 'Plano não encontrado' };
      }

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + plano.duracao_dias);

      // Desativar assinatura anterior
      await db.run(
        'UPDATE assinaturas SET status = "inativa" WHERE user_id = ? AND status = "ativa"',
        [userId]
      );

      // Criar nova assinatura
      const result = await db.run(`
        INSERT INTO assinaturas (user_id, plano_id, data_expiracao, status)
        VALUES (?, ?, ?, 'ativa')
      `, [userId, planoId, dataExpiracao.toISOString()]);

      return { sucesso: true, assinaturaId: result.lastID };
    } catch (error) {
      console.error('Erro ao renovar assinatura:', error);
      return { sucesso: false, mensagem: 'Erro ao renovar assinatura' };
    }
  }

  static async cancelarAssinatura(userId) {
    try {
      await db.run(
        'UPDATE assinaturas SET status = "cancelada" WHERE user_id = ? AND status = "ativa"',
        [userId]
      );

      // Remover VIP do usuário
      await db.run('UPDATE usuarios SET vip = 0 WHERE user_id = ?', [userId]);

      return { sucesso: true, mensagem: 'Assinatura cancelada' };
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      return { sucesso: false, mensagem: 'Erro ao cancelar assinatura' };
    }
  }

  static async obterResumoAssinaturas() {
    try {
      const ativas = await db.get(
        'SELECT COUNT(*) as total FROM assinaturas WHERE status = "ativa" AND data_expiracao > CURRENT_TIMESTAMP'
      );

      const vencidas = await db.get(
        'SELECT COUNT(*) as total FROM assinaturas WHERE data_expiracao < CURRENT_TIMESTAMP'
      );

      const canceladas = await db.get(
        'SELECT COUNT(*) as total FROM assinaturas WHERE status = "cancelada"'
      );

      return {
        ativas: ativas?.total || 0,
        vencidas: vencidas?.total || 0,
        canceladas: canceladas?.total || 0
      };
    } catch (error) {
      console.error('Erro ao obter resumo:', error);
      return { ativas: 0, vencidas: 0, canceladas: 0 };
    }
  }

  static async verificarAssinaturasVencidas() {
    try {
      await db.run(`
        UPDATE assinaturas 
        SET status = 'vencida'
        WHERE status = 'ativa' AND data_expiracao < CURRENT_TIMESTAMP
      `);

      // Remover VIP de usuários com assinatura vencida
      await db.run(`
        UPDATE usuarios 
        SET vip = 0
        WHERE user_id IN (
          SELECT DISTINCT user_id FROM assinaturas 
          WHERE status = 'vencida'
        )
      `);

      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao verificar assinaturas vencidas:', error);
      return { sucesso: false };
    }
  }

  static async obterAssinaturasProximasAVencer() {
    try {
      const assinaturas = await db.all(`
        SELECT 
          u.user_id,
          u.nome,
          a.data_expiracao,
          p.nome as plano_nome
        FROM assinaturas a
        JOIN usuarios u ON a.user_id = u.user_id
        JOIN planos p ON a.plano_id = p.id
        WHERE a.status = 'ativa'
        AND a.data_expiracao > CURRENT_TIMESTAMP
        AND a.data_expiracao <= datetime('now', '+3 days')
        ORDER BY a.data_expiracao ASC
      `);

      return assinaturas || [];
    } catch (error) {
      console.error('Erro ao obter assinaturas próximas a vencer:', error);
      return [];
    }
  }
}

module.exports = Subscriptions;
