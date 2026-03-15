import express from 'express';
import { query } from '../db.js';

const router = express.Router();

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATE_ONLY_REGEX.test(trimmed)) return trimmed;

  const datePart = trimmed.split('T')[0]?.split(' ')[0];
  if (datePart && DATE_ONLY_REGEX.test(datePart)) return datePart;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeBillRow(row) {
  if (!row || typeof row !== 'object' || !('id' in row)) return row;

  return {
    ...row,
    due_date: formatDateOnly(row.due_date),
    paid_date: formatDateOnly(row.paid_date),
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : 0,
    total_amount: row.total_amount !== null && row.total_amount !== undefined ? Number(row.total_amount) : 0,
  };
}

function sanitizeBillPayload(payload = {}) {
  return {
    description: payload.description,
    supplier: payload.supplier ?? null,
    category: payload.category ?? null,
    payment_type: payload.payment_type || 'single',
    total_amount: payload.total_amount,
    installments_count: payload.installments_count ?? 1,
    current_installment: payload.current_installment ?? 1,
    parent_bill_id: payload.parent_bill_id ?? null,
    amount: payload.amount,
    due_date: payload.due_date,
    paid_date: payload.paid_date ?? null,
    status: payload.status || 'pending',
    notes: payload.notes ?? null,
  };
}

// GET /api/bills — lista contas (somente pai, para manter consistência com o preview)
router.get('/', async (_req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM bills_payable WHERE parent_bill_id IS NULL ORDER BY due_date ASC, id ASC'
    );

    const data = Array.isArray(rows)
      ? rows.filter(r => r && typeof r === 'object' && 'id' in r).map(normalizeBillRow)
      : [];

    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /bills error:', err);
    res.status(500).json({ success: false, error: `Erro ao buscar contas: ${err.message || err}` });
  }
});

// POST /api/bills — cria conta única ou parcela pai
router.post('/', async (req, res) => {
  try {
    const bill = sanitizeBillPayload(req.body);

    if (!bill.description || !bill.due_date || bill.total_amount === undefined || bill.amount === undefined) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: description, due_date, total_amount, amount' });
    }

    const result = await query(
      `INSERT INTO bills_payable
      (description, supplier, category, payment_type, total_amount, installments_count, current_installment, parent_bill_id, amount, due_date, paid_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bill.description,
        bill.supplier,
        bill.category,
        bill.payment_type,
        bill.total_amount,
        bill.installments_count,
        bill.current_installment,
        bill.parent_bill_id,
        bill.amount,
        bill.due_date,
        bill.paid_date,
        bill.status,
        bill.notes,
      ]
    );

    const inserted = await query('SELECT * FROM bills_payable WHERE id = ?', [Number(result.insertId)]);
    return res.status(201).json({ success: true, data: normalizeBillRow(inserted[0]) });
  } catch (err) {
    console.error('POST /bills error:', err);
    return res.status(500).json({ success: false, error: `Erro ao criar conta: ${err.message || err}` });
  }
});

// POST /api/bills/batch — cria parcelas filhas
router.post('/batch', async (req, res) => {
  try {
    const bills = Array.isArray(req.body?.bills) ? req.body.bills : [];
    if (bills.length === 0) return res.json({ success: true });

    for (const item of bills) {
      const bill = sanitizeBillPayload(item);
      await query(
        `INSERT INTO bills_payable
        (description, supplier, category, payment_type, total_amount, installments_count, current_installment, parent_bill_id, amount, due_date, paid_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bill.description,
          bill.supplier,
          bill.category,
          bill.payment_type,
          bill.total_amount,
          bill.installments_count,
          bill.current_installment,
          bill.parent_bill_id,
          bill.amount,
          bill.due_date,
          bill.paid_date,
          bill.status,
          bill.notes,
        ]
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /bills/batch error:', err);
    return res.status(500).json({ success: false, error: `Erro ao criar parcelas: ${err.message || err}` });
  }
});

// PUT /api/bills/:id — atualiza conta
router.put('/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const fields = [];
    const values = [];

    const addField = (column, value) => {
      fields.push(`${column} = ?`);
      values.push(value);
    };

    if (payload.description !== undefined) addField('description', payload.description);
    if (payload.supplier !== undefined) addField('supplier', payload.supplier || null);
    if (payload.category !== undefined) addField('category', payload.category || null);
    if (payload.payment_type !== undefined) addField('payment_type', payload.payment_type || 'single');
    if (payload.total_amount !== undefined) addField('total_amount', payload.total_amount);
    if (payload.installments_count !== undefined) addField('installments_count', payload.installments_count ?? 1);
    if (payload.current_installment !== undefined) addField('current_installment', payload.current_installment ?? 1);
    if (payload.parent_bill_id !== undefined) addField('parent_bill_id', payload.parent_bill_id ?? null);
    if (payload.amount !== undefined) addField('amount', payload.amount);
    if (payload.due_date !== undefined) addField('due_date', payload.due_date);
    if (payload.paid_date !== undefined) addField('paid_date', payload.paid_date || null);
    if (payload.status !== undefined) addField('status', payload.status || 'pending');
    if (payload.notes !== undefined) addField('notes', payload.notes || null);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum campo para atualizar' });
    }

    values.push(req.params.id);

    await query(
      `UPDATE bills_payable SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const updated = await query('SELECT * FROM bills_payable WHERE id = ?', [req.params.id]);
    return res.json({ success: true, data: normalizeBillRow(updated[0]) });
  } catch (err) {
    console.error('PUT /bills/:id error:', err);
    return res.status(500).json({ success: false, error: `Erro ao atualizar conta: ${err.message || err}` });
  }
});

// DELETE /api/bills/:id — remove conta
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM bills_payable WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /bills/:id error:', err);
    return res.status(500).json({ success: false, error: `Erro ao excluir conta: ${err.message || err}` });
  }
});

// PATCH /api/bills/:id/pay — marca como paga
router.patch('/:id/pay', async (req, res) => {
  try {
    await query(
      "UPDATE bills_payable SET status = 'paid', paid_date = CURDATE(), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('PATCH /bills/:id/pay error:', err);
    return res.status(500).json({ success: false, error: `Erro ao marcar como paga: ${err.message || err}` });
  }
});

export default router;
