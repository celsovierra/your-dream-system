import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Filter, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchQueue, clearQueue, updateQueueItemStatus, type QueueItem } from '@/services/data-layer';

const statusColors: Record<string, string> = {
  pending: 'bg-warning text-warning-foreground',
  sent: 'bg-success text-success-foreground',
  failed: 'bg-destructive text-destructive-foreground',
};

const typeLabels: Record<string, string> = {
  reminder: 'Lembrete',
  due: 'Vencimento',
  overdue: 'Atraso',
  receipt: 'Recibo',
};

const FilaPage = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await fetchQueue();
      setQueue(data);
    } catch (err: any) {
      toast.error('Erro ao carregar fila: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, []);

  const filtered = filterStatus === 'all' ? queue : queue.filter((q) => q.status === filterStatus);

  const handleClear = async () => {
    try {
      await clearQueue();
      setQueue([]);
      toast.success('Fila limpa!');
    } catch (err: any) {
      toast.error('Erro ao limpar fila: ' + (err.message || ''));
    }
  };

  const handleProcess = async () => {
    const pending = queue.filter(q => q.status === 'pending');
    if (pending.length === 0) {
      toast.info('Nenhum item pendente na fila');
      return;
    }
    for (const item of pending) {
      try {
        await updateQueueItemStatus(item.id, 'sent');
      } catch {}
    }
    toast.success(`${pending.length} itens processados!`);
    loadQueue();
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
          <Button variant="outline" size="sm" onClick={loadQueue}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="destructive" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" /> Limpar Fila
          </Button>
          <Button onClick={handleProcess}>
            <Send className="mr-2 h-4 w-4" /> Processar Fila
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <p>Nenhum item na fila</p>
              <p className="text-xs mt-1">A fila é populada automaticamente às 7h</p>
            </div>
          ) : (
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
                      <Badge variant="outline">{typeLabels[item.type] || item.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {Number(item.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {item.due_date ? new Date(item.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{item.days_overdue > 0 ? item.days_overdue : '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.status] || ''}`}>
                        {item.status === 'pending' ? 'Pendente' : item.status === 'sent' ? 'Enviado' : 'Falhou'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FilaPage;
