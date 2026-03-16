import express from 'express';
import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from '../utils/owner-scope.js';

const router = express.Router();

// Listar templates
router.get('/', async (req, res) => {
  try {
    const rows = await queryWithOptionalOwnerScope({
      tableName: 'message_templates',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        let sql = 'SELECT * FROM message_templates WHERE 1=1';
        const params = [];
        if (useOwnerScope && ownerId) {
          // Return templates belonging to this owner OR global templates (NULL owner_id)
          sql += ' AND (owner_id = ? OR owner_id IS NULL)';
          params.push(ownerId);
        }
        sql += ' ORDER BY id';
        return query(sql, params);
      },
    });
    const data = Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object' && 'id' in r) : [];
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar templates' });
  }
});

// Atualizar template
router.put('/:id', async (req, res) => {
  try {
    const { content, is_active } = req.body;
    const fields = [];
    const values = [];
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }
    if (fields.length === 0) return res.status(400).json({ message: 'Nenhum campo' });

    await queryWithOptionalOwnerScope({
      tableName: 'message_templates',
      ownerId: req.ownerId,
      run: async ({ useOwnerScope, ownerId }) => {
        const params = [...values, req.params.id];
        let sql = `UPDATE message_templates SET ${fields.join(', ')} WHERE id = ?`;
        if (useOwnerScope && ownerId) {
          sql += ' AND owner_id = ?';
          params.push(ownerId);
        }
        return query(sql, params);
      },
    });

    const updated = await query('SELECT * FROM message_templates WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar template' });
  }
});

export default router;
