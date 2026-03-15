import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, AlertTriangle, CheckCircle, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats } from '@/types/billing';

const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)'];

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*');

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const allClients = clients || [];
      const activeClients = allClients.filter((c: any) => c.is_active);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let overdueCount = 0;
      let totalOverdue = 0;
      let pendingCount = 0;
      let totalPending = 0;

      allClients.forEach((c: any) => {
        if (!c.due_date || !c.amount) return;
        const due = new Date(c.due_date + 'T00:00:00');
        if (due < today) {
          overdueCount++;
          totalOverdue += Number(c.amount);
        } else {
          pendingCount++;
          totalPending += Number(c.amount);
        }
      });

      const totalRevenue = allClients.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0);

      setStats({
        total_clients: allClients.length,
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
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Clientes', value: stats.total_clients, icon: Users, color: 'text-primary' },
    { label: 'Receita Total', value: `R$ ${stats.total_revenue_month.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-success' },
    { label: 'Pendentes', value: `R$ ${stats.total_pending.toLocaleString('pt-BR')}`, icon: Clock, color: 'text-warning' },
    { label: 'Em Atraso', value: stats.overdue_count, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Clientes Ativos', value: stats.active_clients, icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col items-center p-4 text-center">
              <stat.icon className={`mb-2 h-8 w-8 ${stat.color}`} />
              <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.status_distribution.some(s => s.count > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das Cobranças</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.status_distribution.filter(s => s.count > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, count }) => `${status}: ${count}`}
                >
                  {stats.status_distribution.filter(s => s.count > 0).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
