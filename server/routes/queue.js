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

export default router;
