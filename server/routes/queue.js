import express from 'express';
import { clearSchemaCache, hasColumn, isUnknownColumnError, query } from '../db.js';

const router = express.Router();

async function supportsOwnerScope() {
  return hasColumn('billing_queue', 'owner_id');
}

// GET /api/queue — lista fila do owner
router.get('/', async (req, res) => {
  try {
    const ownerScoped = await supportsOwnerScope();
    let sql = 'SELECT * FROM billing_queue WHERE 1=1';
    const params = [];
    if (ownerScoped && req.ownerId) {
      sql += ' AND owner_id = ?';
      params.push(req.ownerId);
    }
    sql += ' ORDER BY created_at DESC';

    let rows;
    try {
      rows = await query(sql, params);
    } catch (err) {
      if (!isUnknownColumnError(err)) throw err;
      clearSchemaCache();
      rows = await query('SELECT * FROM billing_queue WHERE 1=1 ORDER BY created_at DESC', []);
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/queue — limpa fila do owner
router.delete('/', async (req, res) => {
  try {
    const ownerScoped = await supportsOwnerScope();
    let sql = 'DELETE FROM billing_queue';
    const params = [];
    if (ownerScoped && req.ownerId) {
      sql += ' WHERE owner_id = ?';
      params.push(req.ownerId);
    }

    try {
      await query(sql, params);
    } catch (err) {
      if (!isUnknownColumnError(err)) throw err;
      clearSchemaCache();
      await query('DELETE FROM billing_queue', []);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/queue/:id — atualiza status de um item
router.patch('/:id', async (req, res) => {
  try {
    const ownerScoped = await supportsOwnerScope();
    const { status, sent_at } = req.body;
    let sql = 'UPDATE billing_queue SET status = ?, sent_at = ? WHERE id = ?';
    const params = [status, sent_at || null, req.params.id];
    if (ownerScoped && req.ownerId) {
      sql += ' AND owner_id = ?';
      params.push(req.ownerId);
    }

    try {
      await query(sql, params);
    } catch (err) {
      if (!isUnknownColumnError(err)) throw err;
      clearSchemaCache();
      await query('UPDATE billing_queue SET status = ?, sent_at = ? WHERE id = ?', [status, sent_at || null, req.params.id]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
