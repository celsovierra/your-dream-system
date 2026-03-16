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
    const ownerId = ownerScoped ? (req.ownerId || '__global__') : '__global__';
    const rows = await query(
      'SELECT `key`, `value` FROM billing_settings WHERE owner_id = ?',
      [ownerId]
    );
    const settings = {};
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && typeof row === 'object' && 'key' in row) {
          settings[row.key] = row.value;
        }
      }
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
