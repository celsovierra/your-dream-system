import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, AlertTriangle, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchDashboardStats } from '@/services/data-layer';
import type { DashboardStats } from '@/types/billing';

function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    months.push({ month: label, receita: 0, pendente: 0 });
  }
  return months;
}

const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const statCards = [
    { label: 'Total Clientes', value: stats.total_clients, icon: Users, color: 'text-primary' },
    { label: 'Receita Total', value: `R$ ${stats.total_revenue_month.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-success' },
    { label: 'Pendentes', value: `R$ ${stats.total_pending.toLocaleString('pt-BR')}`, icon: Clock, color: 'text-warning' },
    { label: 'Em Atraso', value: stats.overdue_count, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Clientes Ativos', value: stats.active_clients, icon: TrendingUp, color: 'text-primary' },
  ];

  // Build last 12 months data from revenue_by_month if available, otherwise use placeholder
  const monthlyData = getLast12Months();
  if (stats.revenue_by_month && stats.revenue_by_month.length > 0) {
    stats.revenue_by_month.forEach((item: any) => {
      const found = monthlyData.find(m => m.month === item.month);
      if (found) {
        found.receita = item.receita || item.revenue || 0;
        found.pendente = item.pendente || item.pending || 0;
      }
    });
  } else {
    // Put current totals in current month
    const current = monthlyData[monthlyData.length - 1];
    current.receita = stats.total_revenue_month || 0;
    current.pendente = stats.total_pending || 0;
  }

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

      <Card>
        <CardHeader><CardTitle className="text-base">Faturamento - Últimos 12 Meses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Bar dataKey="receita" name="Receita" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pendente" name="Pendente" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
