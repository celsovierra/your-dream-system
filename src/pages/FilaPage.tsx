import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockQueue } from '@/services/mock-data';
import { Send, RefreshCw, Filter, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  sent: 'bg-success text-success-foreground',
  failed: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

const typeLabels: Record<string, string> = {
  reminder: 'Lembrete',
  due: 'Vencimento',
  overdue: 'Atraso',
  receipt: 'Recibo',
  blocked: 'Bloqueio',
};

const FilaPage = () => {
  const [queue, setQueue] = useState(mockQueue);
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = filterStatus === 'all' ? queue : queue.filter((q) => q.status === filterStatus);

  const handlePopulate = () => {
    toast.success('Fila populada com cobranças do dia');
  };

  const handleProcess = () => {
    setQueue((prev) =>
      prev.map((q) => (q.status === 'pending' ? { ...q, status: 'sent' as const, sent_at: new Date().toISOString() } : q))
    );
    toast.success('Fila processada! Mensagens enviadas.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePopulate}>
            <RefreshCw className="mr-2 h-4 w-4" /> Popular Fila
          </Button>
          <Button onClick={handleProcess}>
            <Send className="mr-2 h-4 w-4" /> Processar Fila
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                <TableHead className="hidden md:table-cell">Dias Atraso</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.client_name}</p>
                      <p className="text-xs text-muted-foreground">{item.client_phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{typeLabels[item.message_type]}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{item.due_date}</TableCell>
                  <TableCell className="hidden md:table-cell">{item.days_overdue > 0 ? item.days_overdue : '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.status]}`}>
                      {item.status === 'pending' ? 'Pendente' : item.status === 'sent' ? 'Enviado' : item.status === 'failed' ? 'Falhou' : 'Cancelado'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FilaPage;
