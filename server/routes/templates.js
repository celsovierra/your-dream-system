import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Listar templates
router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM message_templates ORDER BY id');
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

    values.push(req.params.id);
    await query(`UPDATE message_templates SET ${fields.join(', ')} WHERE id = ?`, values);
    const updated = await query('SELECT * FROM message_templates WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar template' });
  }
});

export default router;
