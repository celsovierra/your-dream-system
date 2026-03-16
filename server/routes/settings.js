import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/settings — configurações do owner
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT `key`, `value` FROM billing_settings WHERE 1=1';
    const params = [];
    if (req.ownerId) {
      sql += ' AND owner_id = ?';
      params.push(req.ownerId);
    }
    const rows = await query(sql, params);
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings — salva configurações do owner
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    const ownerId = req.ownerId || null;
    for (const [key, value] of Object.entries(settings)) {
      if (ownerId) {
        await query(
          'INSERT INTO billing_settings (`key`, `value`, `owner_id`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          [key, String(value), ownerId, String(value)]
        );
      } else {
        await query(
          'INSERT INTO billing_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          [key, String(value), String(value)]
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
