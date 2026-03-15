import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';

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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie contratos e envie para assinatura digital</p>
        <Button onClick={() => toast.info('Em produção, abrirá modal de criação')}>
          <Plus className="mr-2 h-4 w-4" /> Novo Contrato
        </Button>
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
