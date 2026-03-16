import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, Send, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchClients, createClient } from '@/services/data-layer';

const mockContracts = [
  { id: 1, client_name: 'João Silva', template: 'Contrato Padrão', status: 'signed', signed_at: '2024-03-10', created_at: '2024-03-08' },
  { id: 2, client_name: 'Maria Santos', template: 'Contrato Padrão', status: 'sent', signed_at: null, created_at: '2024-03-15' },
  { id: 3, client_name: 'Carlos Oliveira', template: 'Contrato Padrão', status: 'draft', signed_at: null, created_at: '2024-03-18' },
];

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'outline' },
  signed: { label: 'Assinado', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const ContratosPage = () => {
  const [traccarLoading, setTraccarLoading] = useState(false);

  const traccarConfigured = !!(localStorage.getItem('traccar_url') && localStorage.getItem('traccar_user') && localStorage.getItem('traccar_password'));

  const handleImportTraccar = async () => {
    const traccarUrl = localStorage.getItem('traccar_url');
    const traccarUser = localStorage.getItem('traccar_user');
    const traccarPassword = localStorage.getItem('traccar_password');

    if (!traccarUrl || !traccarUser || !traccarPassword) {
      toast.error('Configure a API Traccar em Configurações primeiro');
      return;
    }

    setTraccarLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('traccar-proxy', {
        body: { traccar_url: traccarUrl, traccar_user: traccarUser, traccar_password: traccarPassword, endpoint: '/api/users', method: 'GET' },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const traccarUsers = data?.data;
      if (!Array.isArray(traccarUsers) || traccarUsers.length === 0) {
        toast.info('Nenhum usuário encontrado no Traccar');
        return;
      }

      toast.success(`${traccarUsers.length} usuário(s) encontrado(s) no Traccar!`);
      console.log('Traccar users:', traccarUsers);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao buscar usuários do Traccar');
    } finally {
      setTraccarLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie contratos e envie para assinatura digital</p>
        <div className="flex gap-2">
          {traccarConfigured && (
            <Button variant="outline" onClick={handleImportTraccar} disabled={traccarLoading}>
              {traccarLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
              {traccarLoading ? 'Importando...' : 'Importar Traccar'}
            </Button>
          )}
          <Button onClick={() => toast.info('Em produção, abrirá modal de criação')}>
            <Plus className="mr-2 h-4 w-4" /> Novo Contrato
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Assinado em</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.client_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      {contract.template}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusLabels[contract.status].variant}>
                      {statusLabels[contract.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{contract.signed_at || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell">{contract.created_at}</TableCell>
                  <TableCell className="text-right">
                    {contract.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => toast.success('Contrato enviado!')}>
                        <Send className="mr-1 h-3 w-3" /> Enviar
                      </Button>
                    )}
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

export default ContratosPage;
