import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from './owner-scope.js';

export function isTemplateRow(row) {
  return Boolean(row && typeof row === 'object' && 'id' in row && row.type);
}

export function sortTemplatesByPriority(a, b, ownerId) {
  const aOwned = ownerId && a?.owner_id === ownerId ? 1 : 0;
  const bOwned = ownerId && b?.owner_id === ownerId ? 1 : 0;
  if (aOwned !== bOwned) return bOwned - aOwned;
  return Number(b?.id || 0) - Number(a?.id || 0);
}

export function dedupeTemplatesByType(rows, ownerId) {
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

export async function listResolvedTemplates(ownerId) {
  const rows = await queryWithOptionalOwnerScope({
    tableName: 'message_templates',
    ownerId,
    run: async ({ useOwnerScope, ownerId: scopedOwnerId }) => {
      let sql = 'SELECT * FROM message_templates WHERE 1=1';
      const params = [];
      if (useOwnerScope && scopedOwnerId) {
        sql += ' AND (owner_id = ? OR owner_id IS NULL)';
        params.push(scopedOwnerId);
      }
      sql += ' ORDER BY id DESC';
      return query(sql, params);
    },
  });

  const validRows = Array.isArray(rows) ? rows.filter(isTemplateRow) : [];
  return dedupeTemplatesByType(validRows, ownerId);
}

export async function resolveTemplateByType(type, ownerId, options = {}) {
  const { activeOnly = false } = options;
  const rows = await queryWithOptionalOwnerScope({
    tableName: 'message_templates',
    ownerId,
    run: async ({ useOwnerScope, ownerId: scopedOwnerId }) => {
      let sql = 'SELECT * FROM message_templates WHERE type = ?';
      const params = [type];
      if (activeOnly) sql += ' AND is_active = 1';
      if (useOwnerScope && scopedOwnerId) {
        sql += ' AND (owner_id = ? OR owner_id IS NULL)';
        params.push(scopedOwnerId);
      }
      sql += ' ORDER BY id DESC';
      return query(sql, params);
    },
  });

  const validRows = Array.isArray(rows) ? rows.filter(isTemplateRow) : [];
  return validRows.sort((a, b) => sortTemplatesByPriority(a, b, ownerId))[0] || null;
}

export async function resolveTemplateById(templateId, ownerId) {
  const currentRows = await query('SELECT * FROM message_templates WHERE id = ?', [templateId]);
  const currentTemplate = Array.isArray(currentRows) ? currentRows.find(isTemplateRow) : null;

  if (!currentTemplate) return null;
  if (!ownerId) return currentTemplate;

  return await resolveTemplateByType(currentTemplate.type, ownerId) || currentTemplate;
}

export async function updateResolvedTemplateByType(type, ownerId, payload) {
  const fields = [];
  const values = [];
  if (payload.content !== undefined) { fields.push('content = ?'); values.push(payload.content); }
  if (payload.is_active !== undefined) { fields.push('is_active = ?'); values.push(payload.is_active); }
  if (payload.name !== undefined) { fields.push('name = ?'); values.push(payload.name); }
  if (fields.length === 0) return null;

  const targetTemplate = await resolveTemplateByType(type, ownerId);
  if (!targetTemplate) return null;

  await queryWithOptionalOwnerScope({
    tableName: 'message_templates',
    ownerId,
    run: async ({ useOwnerScope, ownerId: scopedOwnerId }) => {
      const scopedFields = [...fields];
      const scopedValues = [...values];
      const params = [...scopedValues, targetTemplate.id];
      let sql = `UPDATE message_templates SET ${scopedFields.join(', ')} WHERE id = ?`;

      if (useOwnerScope && scopedOwnerId) {
        scopedFields.push('owner_id = ?');
        scopedValues.push(scopedOwnerId);
        params.length = 0;
        params.push(...scopedValues, targetTemplate.id, scopedOwnerId);
        sql = `UPDATE message_templates SET ${scopedFields.join(', ')} WHERE id = ? AND (owner_id = ? OR owner_id IS NULL)`;
      }

      return query(sql, params);
    },
  });

  return await resolveTemplateByType(type, ownerId);
}
