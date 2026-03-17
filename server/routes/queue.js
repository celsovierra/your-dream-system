import express from 'express';
import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from '../utils/owner-scope.js';

const router = express.Router();

// GET /api/queue — lista fila do owner
router.get('/', async (req, res) => {
  try {
    const rows = await queryWithOptionalOwnerScope({
      tableName: 'billing_queue',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'SELECT * FROM billing_queue WHERE 1=1';
        const params = [];

        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          params.push(ownerId);
        }

        sql += ' ORDER BY created_at DESC';
        return query(sql, params);
      },
    });

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/queue — limpa fila do owner
router.delete('/', async (req, res) => {
  try {
    await queryWithOptionalOwnerScope({
      tableName: 'billing_queue',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'DELETE FROM billing_queue';
        const params = [];

        if (useOwnerScope && ownerId) {
          sql += ' WHERE owner_id = ?';
          params.push(ownerId);
        }

        return query(sql, params);
      },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/queue/:id — atualiza status de um item
router.patch('/:id', async (req, res) => {
  try {
    const { status, sent_at } = req.body;

    await queryWithOptionalOwnerScope({
      tableName: 'billing_queue',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'UPDATE billing_queue SET status = ?, sent_at = ? WHERE id = ?';
        const params = [status, sent_at || null, req.params.id];

        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          params.push(ownerId);
        }

        return query(sql, params);
      },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/queue — registra item na fila (envio manual)
router.post('/', async (req, res) => {
  try {
    const { client_id, client_name, client_phone, type, amount, due_date, days_overdue, status, sent_at, message, owner_id } = req.body;

    if (!client_id || !client_name || !client_phone || !type) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: client_id, client_name, client_phone, type' });
    }

    const finalOwnerId = owner_id || req.ownerId || null;

    await query(
      'INSERT INTO billing_queue (client_id, client_name, client_phone, type, amount, due_date, days_overdue, status, sent_at, message, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [client_id, client_name, client_phone, type, amount || 0, due_date || null, days_overdue || 0, status || 'sent', sent_at || null, message || null, finalOwnerId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
