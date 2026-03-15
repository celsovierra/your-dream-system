import express from 'express';
import { query } from '../db.js';

const router = express.Router();

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;

  const datePart = trimmed.split('T')[0]?.split(' ')[0];
  if (datePart && DATE_ONLY_REGEX.test(datePart)) return datePart;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeClientRow(row) {
  if (!row || typeof row !== 'object' || !('id' in row)) return row;
  return {
    ...row,
    due_date: formatDateOnly(row.due_date),
  };
}

// Listar clientes
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 100;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM clients';
    let countSql = 'SELECT COUNT(*) as total FROM clients';
    const params = [];
    const countParams = [];

    if (search) {
      const where = ' WHERE name LIKE ? OR document LIKE ? OR phone LIKE ?';
      const searchParam = `%${search}%`;
      sql += where;
      countSql += where;
      params.push(searchParam, searchParam, searchParam);
      countParams.push(searchParam, searchParam, searchParam);
    }

    sql += ' ORDER BY name LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [countResult] = await query(countSql, countParams);
    const rows = await query(sql, params);

    // Remove metadata row from mariadb driver e normaliza datas
    const data = Array.isArray(rows)
      ? rows.filter(r => r && typeof r === 'object' && 'id' in r).map(normalizeClientRow)
      : [];

    res.json({
      data,
      total: Number(countResult?.total || 0),
      page,
      per_page: limit,
      total_pages: Math.ceil(Number(countResult?.total || 0) / limit),
    });
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({ message: `Erro ao buscar clientes: ${err.message || err}` });
  }
});

// Buscar cliente por ID
router.get('/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Cliente não encontrado' });
    res.json(normalizeClientRow(rows[0]));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar cliente' });
  }
});

// Criar cliente
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'Nome e telefone são obrigatórios' });

    const result = await query(
      'INSERT INTO clients (name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email || null, phone, phone2 || null, document || null, amount || null, due_date || null, address || null, city || null, state || null, zip_code || null, notes || null]
    );

    const newClient = await query('SELECT * FROM clients WHERE id = ?', [Number(result.insertId)]);
    res.status(201).json(normalizeClientRow(newClient[0]));
  } catch (err) {
    console.error('POST /clients error:', err);
    res.status(500).json({ message: `Erro ao criar cliente: ${err.message || err}` });
  }
});

// Atualizar cliente
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes, is_active } = req.body;

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email || null); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (phone2 !== undefined) { fields.push('phone2 = ?'); values.push(phone2 || null); }
    if (document !== undefined) { fields.push('document = ?'); values.push(document || null); }
    if (amount !== undefined) { fields.push('amount = ?'); values.push(amount || null); }
    if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date || null); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address || null); }
    if (city !== undefined) { fields.push('city = ?'); values.push(city || null); }
    if (state !== undefined) { fields.push('state = ?'); values.push(state || null); }
    if (zip_code !== undefined) { fields.push('zip_code = ?'); values.push(zip_code || null); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes || null); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }

    if (fields.length === 0) return res.status(400).json({ message: 'Nenhum campo para atualizar' });

    values.push(req.params.id);
    await query(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, values);

    const updated = await query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('PUT /clients error:', err);
    res.status(500).json({ message: 'Erro ao atualizar cliente' });
  }
});

// Deletar cliente
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cliente removido' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover cliente' });
  }
});

export default router;
