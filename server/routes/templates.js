import express from 'express';
import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from '../utils/owner-scope.js';

const router = express.Router();

function isTemplateActive(template) {
  return Boolean(template?.is_active);
}

function isTemplateRow(row) {
  return Boolean(row && typeof row === 'object' && 'id' in row && row.type);
}

function sortTemplatesByPriority(a, b, ownerId) {
  const aOwned = ownerId && a?.owner_id === ownerId ? 1 : 0;
  const bOwned = ownerId && b?.owner_id === ownerId ? 1 : 0;
  if (aOwned !== bOwned) return bOwned - aOwned;
  return Number(b?.id || 0) - Number(a?.id || 0);
}

function dedupeTemplatesByType(rows, ownerId) {
  const map = new Map();

  for (const row of rows) {
    if (!isTemplateRow(row)) continue;
    const current = map.get(row.type);
    if (!current || sortTemplatesByPriority(row, current, ownerId) < 0) {
      map.set(row.type, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

async function findPreferredTemplateTarget(templateId, ownerId) {
  const currentRows = await query('SELECT * FROM message_templates WHERE id = ?', [templateId]);
  const currentTemplate = Array.isArray(currentRows) ? currentRows.find(isTemplateRow) : null;

  if (!currentTemplate) return null;
  if (!ownerId) return currentTemplate;

  const sameTypeRows = await query(
    'SELECT * FROM message_templates WHERE type = ? AND (owner_id = ? OR owner_id IS NULL) ORDER BY id DESC',
    [currentTemplate.type, ownerId]
  );

  const validRows = Array.isArray(sameTypeRows) ? sameTypeRows.filter(isTemplateRow) : [];
  if (validRows.length === 0) return currentTemplate;

  return [...validRows].sort((a, b) => sortTemplatesByPriority(a, b, ownerId))[0] || currentTemplate;
}

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
          sql += ' AND (owner_id = ? OR owner_id IS NULL)';
          params.push(ownerId);
        }
        sql += ' ORDER BY id DESC';
        return query(sql, params);
      },
    });

    const validRows = Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object' && 'id' in r) : [];
    const data = dedupeTemplatesByType(validRows, req.ownerId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar templates' });
  }
});

// Atualizar template
router.put('/:id', async (req, res) => {
  try {
    const { content, is_active, name } = req.body;
    const fields = [];
    const values = [];
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active); }
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (fields.length === 0) return res.status(400).json({ message: 'Nenhum campo' });

    const ownerId = req.ownerId;

    await queryWithOptionalOwnerScope({
      tableName: 'message_templates',
      ownerId,
      run: async ({ useOwnerScope, ownerId: scopedOwnerId }) => {
        const scopedFields = [...fields];
        const scopedValues = [...values];

        if (useOwnerScope && scopedOwnerId) {
          scopedFields.push('owner_id = ?');
          scopedValues.push(scopedOwnerId);
        }

        const params = [...scopedValues, req.params.id];
        let sql = `UPDATE message_templates SET ${scopedFields.join(', ')} WHERE id = ?`;
        if (useOwnerScope && scopedOwnerId) {
          sql += ' AND (owner_id = ? OR owner_id IS NULL)';
          params.push(scopedOwnerId);
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
