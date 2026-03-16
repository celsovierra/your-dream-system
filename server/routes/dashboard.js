import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    if (req.ownerId) {
      sql += ' AND owner_id = ?';
      params.push(req.ownerId);
    }

    const clients = await query(sql, params);
    const data = Array.isArray(clients) ? clients.filter(r => r && typeof r === 'object' && 'id' in r) : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueCount = 0, totalOverdue = 0, pendingCount = 0, totalPending = 0;
    const activeClients = data.filter(c => c.is_active);

    data.forEach(c => {
      if (!c.due_date || !c.amount) return;
      const due = new Date(c.due_date);
      if (due < today) {
        overdueCount++;
        totalOverdue += Number(c.amount);
      } else {
        pendingCount++;
        totalPending += Number(c.amount);
      }
    });

    const totalRevenue = data.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    res.json({
      total_clients: data.length,
      active_clients: activeClients.length,
      total_revenue_month: totalRevenue,
      total_pending: totalPending,
      total_overdue: totalOverdue,
      overdue_count: overdueCount,
      paid_count: 0,
      pending_count: pendingCount,
      revenue_by_month: [],
      status_distribution: [
        { status: 'Pendente', count: pendingCount },
        { status: 'Atrasado', count: overdueCount },
      ],
    });
  } catch (err) {
    console.error('GET /dashboard/stats error:', err);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
});

export default router;
