import { query } from '../db.js';
import { queryWithOptionalOwnerScope } from './owner-scope.js';

const DEFAULT_TEMPLATES = {
  reminder: {
    name: 'Lembrete',
    type: 'reminder',
    content: '🚨 Olá *{nome}*, tudo bem?\nBom dia, aqui é um lembrete que sua fatura já está disponível.\n\n🗓 *Vencimento:* {vencimento}\n💰 *Valor:* R$ {valor}\n💸 *Desconto:* {desconto}\n\nPIX Copia e Cola:\n{pix_copia_cola}\n\nApós vencimento será cobrado juros pela operadora.\n\n_O pagamento é confirmado automaticamente. Você receberá o recibo em seguida, sem precisar enviar comprovante._',
    is_active: 1,
  },
  due: {
    name: 'Vencimento',
    type: 'due',
    content: 'Olá *{nome}*!\n\nSua mensalidade está disponível para pagamento.\n\n📅 *Vencimento:* {vencimento}\n💰 *Valor:* R$ {valor}\n💸 *Desconto:* {desconto}\n\nPague agora pelo PIX:\n{pix_copia_cola}\n\n_Após o pagamento, você receberá seu recibo automaticamente._',
    is_active: 1,
  },
  overdue: {
    name: 'Atraso',
    type: 'overdue',
    content: 'Olá *{nome}*!\n\nIdentificamos que sua mensalidade está em atraso.\n\n📅 *Vencimento original:* {vencimento}\n💵 *Valor mensal:* R$ {valor}\n📊 *Multa:* {multa}\n📈 *Juros:* {juros}\n💰 *Total a pagar: {valor_atualizado}*\n\nRegularize agora pelo PIX:\n{pix_copia_cola}\n\n_Evite o bloqueio dos serviços._',
    is_active: 1,
  },
  receipt: {
    name: 'Recibo',
    type: 'receipt',
    content: '✅ *Pagamento Confirmado!* ✅\n\n```RECIBO DE PAGAMENTO\n=======================\nCliente : {nome}\nServiço : Rastreamento\nPeríodo : {vencimento}\nValor   : R$ {valor}\nMulta   : {multa}\nJuros   : {juros}\nDesconto: {desconto}\n\nValor Total : {valor_atualizado}\n=======================\nPago em : {data_hoje}\nStatus  : ✅PAGO✅\nPróx Venc: {prox_vencimento}\n=======================```',
    is_active: 1,
  },
};

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

async function getTemplatesByType(type, ownerId, options = {}) {
  const { activeOnly = false } = options;
  return await queryWithOptionalOwnerScope({
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
}

async function getGlobalTemplateByType(type) {
  const rows = await query(
    'SELECT * FROM message_templates WHERE type = ? AND owner_id IS NULL ORDER BY id DESC',
    [type]
  );
  return Array.isArray(rows) ? rows.find(isTemplateRow) || null : null;
}

async function ensureGlobalTemplate(type) {
  const existing = await getGlobalTemplateByType(type);
  if (existing) return existing;

  const fallback = DEFAULT_TEMPLATES[type];
  if (!fallback) return null;

  const result = await query(
    'INSERT INTO message_templates (name, type, content, is_active, owner_id) VALUES (?, ?, ?, ?, NULL)',
    [fallback.name, fallback.type, fallback.content, fallback.is_active]
  );

  const insertId = Number(result?.insertId ?? result?.[0]?.insertId ?? 0);
  if (!insertId) return await getGlobalTemplateByType(type);

  const inserted = await query('SELECT * FROM message_templates WHERE id = ?', [insertId]);
  return Array.isArray(inserted) ? inserted.find(isTemplateRow) || null : null;
}

async function ensureDefaultGlobalTemplates() {
  for (const type of Object.keys(DEFAULT_TEMPLATES)) {
    await ensureGlobalTemplate(type);
  }
}

async function getOwnedTemplateByType(type, ownerId) {
  if (!ownerId) return null;
  const rows = await query(
    'SELECT * FROM message_templates WHERE type = ? AND owner_id = ? ORDER BY id DESC',
    [type, ownerId]
  );
  return Array.isArray(rows) ? rows.find(isTemplateRow) || null : null;
}

export async function listResolvedTemplates(ownerId) {
  await ensureDefaultGlobalTemplates();

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
  await ensureGlobalTemplate(type);
  const rows = await getTemplatesByType(type, ownerId, options);
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

  const globalTemplate = await ensureGlobalTemplate(type);
  if (!globalTemplate) return null;

  if (ownerId) {
    const ownedTemplate = await getOwnedTemplateByType(type, ownerId);

    if (ownedTemplate) {
      await query(`UPDATE message_templates SET ${fields.join(', ')} WHERE id = ? AND owner_id = ?`, [...values, ownedTemplate.id, ownerId]);
    } else {
      await query(
        'INSERT INTO message_templates (name, type, content, is_active, owner_id) VALUES (?, ?, ?, ?, ?)',
        [
          payload.name ?? globalTemplate.name,
          type,
          payload.content ?? globalTemplate.content,
          payload.is_active ?? globalTemplate.is_active,
          ownerId,
        ]
      );
    }

    return await resolveTemplateByType(type, ownerId);
  }

  await query(`UPDATE message_templates SET ${fields.join(', ')} WHERE id = ? AND owner_id IS NULL`, [...values, globalTemplate.id]);
  return await resolveTemplateByType(type, null);
}
