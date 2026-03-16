import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, Send, MapPin, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { upsertClientFromTraccar } from '@/services/data-layer';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'outline' },
  signed: { label: 'Assinado', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

interface Contract {
  id: number;
  client_name: string;
  template: string;
  status: string;
  signed_at: string | null;
  created_at: string;
}

const CONTRACTS_STORAGE_KEY = 'contracts_data';

const defaultContracts: Contract[] = [
  { id: 1, client_name: 'João Silva', template: 'Contrato Padrão', status: 'signed', signed_at: '2024-03-10', created_at: '2024-03-08' },
  { id: 2, client_name: 'Maria Santos', template: 'Contrato Padrão', status: 'sent', signed_at: null, created_at: '2024-03-15' },
  { id: 3, client_name: 'Carlos Oliveira', template: 'Contrato Padrão', status: 'draft', signed_at: null, created_at: '2024-03-18' },
];

const ContratosPage = () => {
  const [traccarLoading, setTraccarLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = localStorage.getItem(CONTRACTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultContracts;
  });

  const traccarConfigured = !!(localStorage.getItem('traccar_url') && localStorage.getItem('traccar_user') && localStorage.getItem('traccar_password'));

  useEffect(() => {
    localStorage.setItem(CONTRACTS_STORAGE_KEY, JSON.stringify(contracts));
  }, [contracts]);

  const handleDeleteContract = (id: number) => {
    setContracts(prev => prev.filter(c => c.id !== id));
    toast.success('Contrato removido!');
  };

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

      let imported = 0, updated = 0;
      for (const user of traccarUsers) {
        const name = user.name || user.email || 'Sem nome';
        const phone = user.phone ? user.phone.replace(/\D/g, '') : '';
        const email = user.email || '';

        try {
          const result = await upsertClientFromTraccar({
            name,
            phone: phone.length > 2 ? phone : '55',
            email,
          });
          if (result === 'created') imported++;
          if (result === 'updated') updated++;
        } catch (err) {
          console.error(`Erro ao importar ${name}:`, err);
        }
      }

      const msgs: string[] = [];
      if (imported > 0) msgs.push(`${imported} novo(s)`);
      if (updated > 0) msgs.push(`${updated} atualizado(s)`);
      if (msgs.length > 0) {
        toast.success(`Traccar: ${msgs.join(', ')}!`);
      } else {
        toast.info('Todos os usuários do Traccar já estão sincronizados');
      }
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
              {contracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">{contract.client_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      {contract.template}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusLabels[contract.status]?.variant || 'secondary'}>
                      {statusLabels[contract.status]?.label || contract.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{contract.signed_at || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell">{contract.created_at}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {contract.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => toast.success('Contrato enviado!')}>
                        <Send className="mr-1 h-3 w-3" /> Enviar
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteContract(contract.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum contrato encontrado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContratosPage;
