import express from 'express';
import { hasColumn, query } from '../db.js';

const router = express.Router();

async function supportsOwnerScope() {
  return hasColumn('billing_settings', 'owner_id');
}

// GET /api/settings — configurações do owner
router.get('/', async (req, res) => {
  try {
    const ownerScoped = await supportsOwnerScope();
    let sql = 'SELECT `key`, `value` FROM billing_settings WHERE 1=1';
    const params = [];
    if (ownerScoped && req.ownerId) {
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
    const ownerScoped = await supportsOwnerScope();
    const ownerId = ownerScoped ? (req.ownerId || '__global__') : '__global__';
    for (const [key, value] of Object.entries(settings)) {
      await query(
        'INSERT INTO billing_settings (`key`, `value`, `owner_id`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, String(value), ownerId, String(value)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
