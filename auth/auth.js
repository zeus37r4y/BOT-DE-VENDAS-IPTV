const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_segura';

class Auth {
  static gerarToken(admin) {
    return jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  static verificarToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  static async login(username, senha) {
    try {
      const admin = await db.get(
        'SELECT * FROM admin WHERE username = ? AND ativo = 1',
        [username]
      );

      if (!admin) {
        return { sucesso: false, mensagem: 'Usuário ou senha incorretos' };
      }

      const senhaValida = bcrypt.compareSync(senha, admin.senha);
      if (!senhaValida) {
        return { sucesso: false, mensagem: 'Usuário ou senha incorretos' };
      }

      const token = this.gerarToken(admin);
      
      await db.run(
        'UPDATE admin SET atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
        [admin.id]
      );

      return {
        sucesso: true,
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          nome: admin.nome
        }
      };
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return { sucesso: false, mensagem: 'Erro ao fazer login' };
    }
  }

  static async verificarAdmin(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ sucesso: false, mensagem: 'Token não fornecido' });
      }

      const payload = this.verificarToken(token);
      if (!payload) {
        return res.status(401).json({ sucesso: false, mensagem: 'Token inválido ou expirado' });
      }

      const admin = await db.get('SELECT * FROM admin WHERE id = ?', [payload.id]);
      if (!admin || !admin.ativo) {
        return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
      }

      req.admin = admin;
      next();
    } catch (error) {
      console.error('Erro ao verificar admin:', error);
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao verificar autenticação' });
    }
  }

  static async alterarSenha(adminId, senhaAtual, novaSenha) {
    try {
      const admin = await db.get('SELECT * FROM admin WHERE id = ?', [adminId]);

      if (!admin) {
        return { sucesso: false, mensagem: 'Administrador não encontrado' };
      }

      const senhaValida = bcrypt.compareSync(senhaAtual, admin.senha);
      if (!senhaValida) {
        return { sucesso: false, mensagem: 'Senha atual incorreta' };
      }

      const novaSenhaHash = bcrypt.hashSync(novaSenha, 10);
      await db.run('UPDATE admin SET senha = ? WHERE id = ?', [novaSenhaHash, adminId]);

      return { sucesso: true, mensagem: 'Senha alterada com sucesso' };
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return { sucesso: false, mensagem: 'Erro ao alterar senha' };
    }
  }
}

module.exports = Auth;
