import { useState, useEffect, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getOperationLogs, clearOperationLogs, subscribeToLogs, type OperationLog } from '@/services/operation-logger';
import { getActiveDataBackend } from '@/services/data-layer';
import { ScrollText, Trash2, Search, Database, Server, Cloud } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function useLogs() {
  return useSyncExternalStore(
    subscribeToLogs,
    getOperationLogs,
    getOperationLogs,
  );
}

const LogsPage = () => {
  const logs = useLogs();
  const [search, setSearch] = useState('');
  const [filterBackend, setFilterBackend] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const activeBackend = getActiveDataBackend();

  const filtered = logs.filter((l) => {
    const matchSearch =
      !search ||
      l.module.toLowerCase().includes(search.toLowerCase()) ||
      l.operation.toLowerCase().includes(search.toLowerCase()) ||
      l.detail.toLowerCase().includes(search.toLowerCase());
    const matchBackend = filterBackend === 'all' || l.backend === filterBackend;
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchBackend && matchStatus;
  });

  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;
  const apiCount = logs.filter((l) => l.backend === 'api').length;
  const cloudCount = logs.filter((l) => l.backend === 'cloud').length;

  return (
    <div className="space-y-6">
      {/* Active backend indicator */}
      <Card className="border-2 border-primary/30">
        <CardContent className="flex items-center gap-3 py-4">
          <Database className="h-6 w-6 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Backend ativo neste ambiente</p>
            <p className="text-lg font-bold flex items-center gap-2">
              {activeBackend === 'api' ? (
                <>
                  <Server className="h-4 w-4 text-emerald-500" />
                  VPS / MariaDB
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 text-blue-500" />
                  Cloud / Teste
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">Sucesso</p>
            <p className="text-2xl font-bold text-emerald-500">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">Erros</p>
            <p className="text-2xl font-bold text-destructive">{errorCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">VPS / Cloud</p>
            <p className="text-2xl font-bold">{apiCount} / {cloudCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Logs de Operações
            </CardTitle>
            <Button variant="outline" size="sm" onClick={clearOperationLogs}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por módulo, operação ou detalhe..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterBackend} onValueChange={setFilterBackend}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Backend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="api">VPS</SelectItem>
                <SelectItem value="cloud">Cloud</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Hora</TableHead>
                  <TableHead className="w-[120px]">Backend</TableHead>
                  <TableHead className="w-[100px]">Módulo</TableHead>
                  <TableHead className="w-[100px]">Operação</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {logs.length === 0 ? 'Nenhuma operação registrada ainda. Use o sistema para gerar logs.' : 'Nenhum log encontrado com os filtros atuais.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">
                        {format(new Date(log.timestamp), 'dd/MM HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.backend === 'api' ? 'default' : 'secondary'} className="text-xs">
                          {log.backend === 'api' ? '🖥 VPS' : '☁ Cloud'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{log.module}</TableCell>
                      <TableCell className="text-xs">{log.operation}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={log.detail}>
                        {log.detail}
                      </TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs" title={log.errorMessage}>Erro</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsPage;
