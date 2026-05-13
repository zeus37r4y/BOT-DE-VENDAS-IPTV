const db = require('../database/db');

class Broadcast {
  static async criarBroadcast(titulo, mensagem) {
    try {
      const total = await db.get('SELECT COUNT(*) as count FROM usuarios WHERE bloqueado = 0');

      const broadcast = await db.run(`
        INSERT INTO broadcasts (titulo, mensagem, total)
        VALUES (?, ?, ?)
      `, [titulo, mensagem, total?.count || 0]);

      return { sucesso: true, broadcastId: broadcast.lastID };
    } catch (error) {
      console.error('Erro ao criar broadcast:', error);
      return { sucesso: false, mensagem: 'Erro ao criar broadcast' };
    }
  }

  static async obterBroadcasts() {
    try {
      const broadcasts = await db.all(
        'SELECT * FROM broadcasts ORDER BY criado_em DESC LIMIT 50'
      );
      return broadcasts;
    } catch (error) {
      console.error('Erro ao obter broadcasts:', error);
      return [];
    }
  }

  static async obterBroadcast(broadcastId) {
    try {
      const broadcast = await db.get(
        'SELECT * FROM broadcasts WHERE id = ?',
        [broadcastId]
      );
      return broadcast;
    } catch (error) {
      console.error('Erro ao obter broadcast:', error);
      return null;
    }
  }

  static async obterUsuariosParaBroadcast() {
    try {
      const usuarios = await db.all(
        'SELECT user_id FROM usuarios WHERE bloqueado = 0 AND status = "ativo"'
      );
      return usuarios;
    } catch (error) {
      console.error('Erro ao obter usuários:', error);
      return [];
    }
  }

  static async atualizarStatusBroadcast(broadcastId, status, enviados = null) {
    try {
      let sql = 'UPDATE broadcasts SET status = ? WHERE id = ?';
      let params = [status, broadcastId];

      if (status === 'enviado') {
        sql = 'UPDATE broadcasts SET status = ?, enviado_em = CURRENT_TIMESTAMP, enviados = ? WHERE id = ?';
        params = [status, enviados || 0, broadcastId];
      }

      await db.run(sql, params);
      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao atualizar broadcast:', error);
      return { sucesso: false, mensagem: 'Erro ao atualizar broadcast' };
    }
  }

  static async deletarBroadcast(broadcastId) {
    try {
      await db.run('DELETE FROM broadcasts WHERE id = ?', [broadcastId]);
      return { sucesso: true };
    } catch (error) {
      console.error('Erro ao deletar broadcast:', error);
      return { sucesso: false, mensagem: 'Erro ao deletar broadcast' };
    }
  }
}

module.exports = Broadcast;
