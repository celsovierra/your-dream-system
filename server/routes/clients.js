import express from 'express';
import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from '../utils/owner-scope.js';

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

    const result = await queryWithOptionalOwnerScope({
      tableName: 'clients',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'SELECT * FROM clients WHERE 1=1';
        let countSql = 'SELECT COUNT(*) as total FROM clients WHERE 1=1';
        const params = [];
        const countParams = [];

        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          countSql += ' AND owner_id = ?';
          params.push(ownerId);
          countParams.push(ownerId);
        }

        if (search) {
          const searchClause = ' AND (name LIKE ? OR document LIKE ? OR phone LIKE ?)';
          const searchParam = `%${search}%`;
          sql += searchClause;
          countSql += searchClause;
          params.push(searchParam, searchParam, searchParam);
          countParams.push(searchParam, searchParam, searchParam);
        }

        sql += ' ORDER BY name LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [countResult] = await query(countSql, countParams);
        const rows = await query(sql, params);

        return { countResult, rows };
      },
    });

    const data = Array.isArray(result.rows)
      ? result.rows.filter(r => r && typeof r === 'object' && 'id' in r).map(normalizeClientRow)
      : [];

    res.json({
      data,
      total: Number(result.countResult?.total || 0),
      page,
      per_page: limit,
      total_pages: Math.ceil(Number(result.countResult?.total || 0) / limit),
    });
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({ message: `Erro ao buscar clientes: ${err.message || err}` });
  }
});

// Buscar cliente por ID
router.get('/:id', async (req, res) => {
  try {
    const rows = await queryWithOptionalOwnerScope({
      tableName: 'clients',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'SELECT * FROM clients WHERE id = ?';
        const params = [req.params.id];
        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          params.push(ownerId);
        }
        return query(sql, params);
      },
    });
    if (!rows.length) return res.status(404).json({ message: 'Cliente não encontrado' });
    res.json(normalizeClientRow(rows[0]));
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar cliente' });
  }
});

// Criar cliente
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes, traccar_email } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'Nome e telefone são obrigatórios' });

    const result = await queryWithOptionalOwnerScope({
      tableName: 'clients',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        if (useOwnerScope) {
          return query(
            'INSERT INTO clients (name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes, traccar_email, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, email || null, phone, phone2 || null, document || null, amount || null, due_date || null, address || null, city || null, state || null, zip_code || null, notes || null, traccar_email || null, ownerId || null]
          );
        }
        return query(
          'INSERT INTO clients (name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes, traccar_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [name, email || null, phone, phone2 || null, document || null, amount || null, due_date || null, address || null, city || null, state || null, zip_code || null, notes || null, traccar_email || null]
        );
      },
    });

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
    const { name, email, phone, phone2, document, amount, due_date, address, city, state, zip_code, notes, is_active, traccar_email } = req.body;

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
    if (traccar_email !== undefined) { fields.push('traccar_email = ?'); values.push(traccar_email || null); }

    if (fields.length === 0) return res.status(400).json({ message: 'Nenhum campo para atualizar' });

    await queryWithOptionalOwnerScope({
      tableName: 'clients',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        const params = [...values, req.params.id];
        let sql = `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`;
        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          params.push(ownerId);
        }
        return query(sql, params);
      },
    });

    const updated = await query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json(normalizeClientRow(updated[0]));
  } catch (err) {
    console.error('PUT /clients error:', err);
    res.status(500).json({ message: 'Erro ao atualizar cliente' });
  }
});

// Deletar cliente
router.delete('/:id', async (req, res) => {
  try {
    await queryWithOptionalOwnerScope({
      tableName: 'clients',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'DELETE FROM clients WHERE id = ?';
        const params = [req.params.id];
        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          params.push(ownerId);
        }
        return query(sql, params);
      },
    });
    res.json({ message: 'Cliente removido' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover cliente' });
  }
});

export default router;
