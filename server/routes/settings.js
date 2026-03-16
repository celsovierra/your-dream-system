import express from 'express';
import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from '../utils/owner-scope.js';

const router = express.Router();

// GET /api/settings — configurações do owner
router.get('/', async (req, res) => {
  try {
    const rows = await queryWithOptionalOwnerScope({
      tableName: 'billing_settings',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        const effectiveOwner = (useOwnerScope && ownerId) ? ownerId : '__global__';
        return query(
          'SELECT `key`, `value` FROM billing_settings WHERE owner_id = ?',
          [effectiveOwner]
        );
      },
    });
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

    await queryWithOptionalOwnerScope({
      tableName: 'billing_settings',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        const effectiveOwner = (useOwnerScope && ownerId) ? ownerId : '__global__';
        for (const [key, value] of Object.entries(settings)) {
          await query(
            'INSERT INTO billing_settings (`key`, `value`, `owner_id`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [key, String(value), effectiveOwner, String(value)]
          );
        }
      },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
