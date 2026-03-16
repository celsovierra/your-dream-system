import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cobranca-pro-jwt-secret-2024';
const JWT_EXPIRES_IN = '30d';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
    }

    const loginValue = email.toLowerCase().trim();
    const rows = await query(
      `SELECT * FROM users
       WHERE LOWER(email) = ? OR LOWER(name) = ?
       ORDER BY CASE WHEN LOWER(email) = ? THEN 0 ELSE 1 END, id ASC`,
      [loginValue, loginValue, loginValue]
    );

    const matchingUsers = rows.filter((u) => {
      if (!u || typeof u !== 'object' || !('id' in u)) return false;
      if (u.is_active === false || Number(u.is_active) === 0) return false;
      const hashed = hashPassword(password);
      return u.password_hash === hashed || u.password_hash === password;
    });

    if (matchingUsers.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos' });
    }

    const isEmailLogin = loginValue.includes('@');
    if (!isEmailLogin && matchingUsers.length > 1) {
      return res.status(409).json({
        success: false,
        error: 'Existe mais de um usuário com esse nome. Entre usando o email para acessar a conta correta.',
      });
    }

    const user = matchingUsers[0];

    // Determine role: first user is admin, rest are 'user'
    const allUsers = await query('SELECT id FROM users ORDER BY id ASC');
    const validUsers = allUsers.filter(r => r && typeof r === 'object' && 'id' in r);
    const role = validUsers.length > 0 && String(validUsers[0].id) === String(user.id) ? 'admin' : 'user';

    const token = generateToken({ ...user, role });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role,
          createdAt: user.created_at,
        },
      },
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'Nome, email e senha são obrigatórios' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 4 caracteres' });
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = ?', [email.toLowerCase().trim()]);
    const existingUser = existing.find(r => r && typeof r === 'object' && 'id' in r);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Este email já está cadastrado' });
    }

    const hashed = hashPassword(password);
    const result = await query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email.toLowerCase().trim(), hashed]
    );

    const insertId = Number(result.insertId ?? result[0]?.insertId ?? 0);

    // Determine role
    const allUsers = await query('SELECT id FROM users ORDER BY id ASC');
    const validUsers = allUsers.filter(r => r && typeof r === 'object' && 'id' in r);
    const role = validUsers.length > 0 && validUsers[0].id === insertId ? 'admin' : 'user';

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: String(insertId),
          email: email.toLowerCase().trim(),
          name,
          role,
        },
      },
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    res.status(500).json({ success: false, error: 'Erro ao registrar usuário' });
  }
});

// GET /api/auth/users — lista todos os usuários (apenas admin)
router.get('/users', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, email, is_active, created_at FROM users ORDER BY id ASC');
    const users = rows.filter(r => r && typeof r === 'object' && 'id' in r);

    const data = users.map((u, index) => ({
      id: String(u.id),
      name: u.name,
      email: u.email,
      role: index === 0 ? 'admin' : 'user',
      is_active: u.is_active,
      createdAt: u.created_at,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /auth/users error:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar usuários' });
  }
});

// DELETE /api/auth/users/:id — remove usuário
router.delete('/users/:id', async (req, res) => {
  try {
    // Don't allow deleting the first user (admin)
    const allUsers = await query('SELECT id FROM users ORDER BY id ASC');
    const validUsers = allUsers.filter(r => r && typeof r === 'object' && 'id' in r);
    if (validUsers.length > 0 && String(validUsers[0].id) === String(req.params.id)) {
      return res.status(403).json({ success: false, error: 'Não é possível remover o administrador' });
    }

    await query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /auth/users/:id error:', err);
    res.status(500).json({ success: false, error: 'Erro ao remover usuário' });
  }
});

export { JWT_SECRET };
export default router;
