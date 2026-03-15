import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const mockPayments = [
  { id: 1, client_name: 'João Silva', amount: 150, status: 'paid', paid_at: '2024-03-10 14:30', created_at: '2024-03-08' },
  { id: 2, client_name: 'Maria Santos', amount: 200, status: 'pending', paid_at: null, created_at: '2024-03-15' },
  { id: 3, client_name: 'Carlos Oliveira', amount: 180, status: 'expired', paid_at: null, created_at: '2024-03-01' },
  { id: 4, client_name: 'Pedro Lima', amount: 250, status: 'paid', paid_at: '2024-03-18 09:15', created_at: '2024-03-17' },
];

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  paid: { label: 'Pago', variant: 'default' },
  pending: { label: 'Pendente', variant: 'outline' },
  expired: { label: 'Expirado', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const PagamentosPage = () => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Links de pagamento PIX gerados e seu status</p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Pago em</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
                <TableHead className="text-right">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.client_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-primary" />
                      R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusMap[p.status].variant}>{statusMap[p.status].label}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.paid_at || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell">{p.created_at}</TableCell>
                  <TableCell className="text-right">
                    {p.status === 'pending' && (
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3 w-3" />
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

export default PagamentosPage;
