import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/queue — lista toda a fila
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM billing_queue ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/queue — limpa a fila
router.delete('/', async (req, res) => {
  try {
    await query('DELETE FROM billing_queue');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/queue/:id — atualiza status de um item
router.patch('/:id', async (req, res) => {
  try {
    const { status, sent_at } = req.body;
    await query('UPDATE billing_queue SET status = ?, sent_at = ? WHERE id = ?', [status, sent_at || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
