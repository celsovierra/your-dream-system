import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cobranca-pro-jwt-secret-2024';
const JWT_EXPIRES_IN = '30d';

const ALL_PERMISSIONS = [
  'dashboard', 'clientes', 'fila', 'mensagens', 'contratos', 'financeiro', 'configuracoes', 'logs',
];

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

function parsePermissions(raw) {
  if (!raw) return ALL_PERMISSIONS;
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return ALL_PERMISSIONS; }
}

function formatUser(u) {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    role: u.role || 'user',
    client_limit: u.client_limit ?? 0,
    expires_at: u.expires_at || null,
    permissions: parsePermissions(u.permissions),
    is_active: u.is_active,
    slug: u.slug || null,
    layout_company_name: u.layout_company_name || null,
    layout_logo: u.layout_logo || null,
    layout_primary_color: u.layout_primary_color || null,
    createdAt: u.created_at,
  };
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

    // Check expiration
    if (user.expires_at) {
      const expDate = new Date(user.expires_at);
      if (expDate < new Date()) {
        return res.status(403).json({ success: false, error: 'Sua conta expirou. Entre em contato com o administrador.' });
      }
    }

    const role = user.role || 'user';
    const token = generateToken({ ...user, role });

    res.json({
      success: true,
      data: {
        token,
        user: formatUser(user),
      },
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
});

// POST /api/auth/register — only admin can create users now
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone, client_limit, expires_at, permissions } = req.body;
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
    const permsJson = permissions ? JSON.stringify(permissions) : JSON.stringify(ALL_PERMISSIONS);

    const result = await query(
      'INSERT INTO users (name, email, password_hash, phone, role, client_limit, expires_at, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name,
        email.toLowerCase().trim(),
        hashed,
        phone || null,
        'user',
        client_limit || 0,
        expires_at || null,
        permsJson,
      ]
    );

    const insertId = Number(result.insertId ?? result[0]?.insertId ?? 0);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: String(insertId),
          email: email.toLowerCase().trim(),
          name,
          phone: phone || '',
          role: 'user',
          client_limit: client_limit || 0,
          expires_at: expires_at || null,
          permissions: permissions || ALL_PERMISSIONS,
        },
      },
    });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    res.status(500).json({ success: false, error: 'Erro ao registrar usuário' });
  }
});

// GET /api/auth/users — list all users
router.get('/users', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM users ORDER BY id ASC');
    const users = rows.filter(r => r && typeof r === 'object' && 'id' in r);
    res.json({ success: true, data: users.map(formatUser) });
  } catch (err) {
    console.error('GET /auth/users error:', err);
    res.status(500).json({ success: false, error: 'Erro ao listar usuários' });
  }
});

// PUT /api/auth/users/:id — update user
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, phone, password, client_limit, expires_at, permissions, is_active } = req.body;

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email.toLowerCase().trim()); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone || null); }
    if (password) { fields.push('password_hash = ?'); values.push(hashPassword(password)); }
    if (client_limit !== undefined) { fields.push('client_limit = ?'); values.push(client_limit); }
    if (expires_at !== undefined) { fields.push('expires_at = ?'); values.push(expires_at || null); }
    if (permissions !== undefined) { fields.push('permissions = ?'); values.push(JSON.stringify(permissions)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const rows = await query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    const updated = rows.find(r => r && typeof r === 'object' && 'id' in r);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    res.json({ success: true, data: formatUser(updated) });
  } catch (err) {
    console.error('PUT /auth/users/:id error:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar usuário' });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const rows = await query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    const user = rows.find(r => r && typeof r === 'object' && 'role' in r);
    if (user && user.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Não é possível remover o administrador' });
    }

    await query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /auth/users/:id error:', err);
    res.status(500).json({ success: false, error: 'Erro ao remover usuário' });
  }
});

// GET /api/auth/branding/:slug — public, no auth needed
router.get('/branding/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    const rows = await query(
      'SELECT id, name, slug, layout_company_name, layout_logo, layout_primary_color FROM users WHERE LOWER(slug) = ? AND is_active = 1 LIMIT 1',
      [slug]
    );
    const user = rows.find(r => r && typeof r === 'object' && 'id' in r);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
    }
    res.json({
      success: true,
      data: {
        slug: user.slug,
        company_name: user.layout_company_name || user.name,
        logo: user.layout_logo || null,
        primary_color: user.layout_primary_color || null,
        owner_id: String(user.id),
      },
    });
  } catch (err) {
    console.error('GET /auth/branding/:slug error:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar branding' });
  }
});

// PUT /api/auth/branding — save layout settings for current user
router.put('/branding', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Token ausente' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const { slug, layout_company_name, layout_logo, layout_primary_color } = req.body;

    const fields = [];
    const values = [];

    if (slug !== undefined) {
      // Check uniqueness
      const existing = await query('SELECT id FROM users WHERE LOWER(slug) = ? AND id != ?', [slug.toLowerCase().trim(), userId]);
      const conflict = existing.find(r => r && typeof r === 'object' && 'id' in r);
      if (conflict) {
        return res.status(409).json({ success: false, error: 'Este slug já está em uso por outro usuário' });
      }
      fields.push('slug = ?');
      values.push(slug.toLowerCase().trim() || null);
    }
    if (layout_company_name !== undefined) { fields.push('layout_company_name = ?'); values.push(layout_company_name || null); }
    if (layout_logo !== undefined) { fields.push('layout_logo = ?'); values.push(layout_logo || null); }
    if (layout_primary_color !== undefined) { fields.push('layout_primary_color = ?'); values.push(layout_primary_color || null); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    values.push(userId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /auth/branding error:', err);
    res.status(500).json({ success: false, error: 'Erro ao salvar branding' });
  }
});

export { JWT_SECRET };
export default router;
