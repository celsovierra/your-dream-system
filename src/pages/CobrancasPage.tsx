import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { mockClients } from '@/services/mock-data';
import { DollarSign, Plus } from 'lucide-react';
import { toast } from 'sonner';

const CobrancasPage = () => {
  // Mock billing configs
  const configs = mockClients.filter(c => c.is_active).map((c, i) => ({
    id: i + 1,
    client_id: c.id,
    client_name: c.name,
    due_day: [5, 10, 15, 20, 25][i % 5],
    amount: [150, 200, 180, 120, 250][i % 5],
    description: 'Mensalidade',
    is_active: true,
    next_due_date: `2024-04-${String([5, 10, 15, 20, 25][i % 5]).padStart(2, '0')}`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configurações de cobrança recorrente por cliente
        </p>
        <Button onClick={() => toast.info('Em produção, abrirá modal de configuração')}>
          <Plus className="mr-2 h-4 w-4" /> Nova Cobrança
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Próx. Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.client_name}</TableCell>
                  <TableCell>Dia {config.due_day}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-success" />
                      R$ {config.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{config.description}</TableCell>
                  <TableCell className="hidden md:table-cell">{config.next_due_date}</TableCell>
                  <TableCell>
                    <Badge variant={config.is_active ? 'default' : 'secondary'}>
                      {config.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
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

export default CobrancasPage;
