import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, ExternalLink, Plus, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PixPayment {
  id: number;
  client_name: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  payment_id?: number;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  paid: { label: 'Pago', variant: 'default' },
  pending: { label: 'Pendente', variant: 'outline' },
  approved: { label: 'Pago', variant: 'default' },
  expired: { label: 'Expirado', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const PagamentosPage = () => {
  const [payments, setPayments] = useState<PixPayment[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pixResult, setPixResult] = useState<{ qr_code?: string; qr_code_base64?: string; ticket_url?: string } | null>(null);

  const [form, setForm] = useState({
    client_name: '',
    amount: '',
    description: '',
    payer_email: '',
    payer_cpf: '',
  });

  const getAccessToken = () => {
    return localStorage.getItem('mp_access_token') || '';
  };

  const handleGeneratePix = async () => {
    const access_token = getAccessToken();
    if (!access_token) {
      toast.error('Configure o Access Token do Mercado Pago em Configurações');
      return;
    }

    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-pix', {
        body: {
          access_token,
          amount,
          description: form.description || `Cobrança - ${form.client_name}`,
          payer_email: form.payer_email,
          payer_name: form.client_name,
          payer_cpf: form.payer_cpf,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const result = data.data;
        setPixResult({
          qr_code: result.qr_code,
          qr_code_base64: result.qr_code_base64,
          ticket_url: result.ticket_url,
        });

        setPayments(prev => [{
          id: result.payment_id,
          client_name: form.client_name,
          amount,
          status: result.status,
          paid_at: null,
          created_at: new Date().toISOString().split('T')[0],
          qr_code: result.qr_code,
          qr_code_base64: result.qr_code_base64,
          ticket_url: result.ticket_url,
          payment_id: result.payment_id,
        }, ...prev]);

        toast.success('PIX gerado com sucesso!');
      } else {
        toast.error(data?.error || 'Erro ao gerar PIX');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar com Mercado Pago');
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código PIX copiado!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Cobranças PIX via Mercado Pago</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPixResult(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-3 w-3" /> Gerar PIX
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gerar Cobrança PIX</DialogTitle>
            </DialogHeader>

            {!pixResult ? (
              <div className="space-y-4">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="João Silva" />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="150.00" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Mensalidade Internet" />
                </div>
                <div>
                  <Label>E-mail do Pagador</Label>
                  <Input type="email" value={form.payer_email} onChange={e => setForm({ ...form, payer_email: e.target.value })} placeholder="cliente@email.com" />
                </div>
                <div>
                  <Label>CPF do Pagador</Label>
                  <Input value={form.payer_cpf} onChange={e => setForm({ ...form, payer_cpf: e.target.value })} placeholder="00000000000" />
                </div>
                <Button className="w-full" onClick={handleGeneratePix} disabled={loading}>
                  {loading ? 'Gerando...' : 'Gerar Cobrança PIX'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                {pixResult.qr_code_base64 && (
                  <div className="flex justify-center">
                    <img src={`data:image/png;base64,${pixResult.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48 rounded-lg border" />
                  </div>
                )}
                {pixResult.qr_code && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Código PIX (Copia e Cola)</Label>
                    <div className="flex gap-2">
                      <Input value={pixResult.qr_code} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyPixCode(pixResult.qr_code!)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {pixResult.ticket_url && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(pixResult.ticket_url, '_blank')}>
                    <ExternalLink className="mr-2 h-3 w-3" /> Abrir Link de Pagamento
                  </Button>
                )}
                <Button variant="secondary" className="w-full" onClick={() => { setPixResult(null); setForm({ client_name: '', amount: '', description: '', payer_email: '', payer_cpf: '' }); }}>
                  Gerar Novo PIX
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">ID Pagamento</TableHead>
                <TableHead className="hidden md:table-cell">Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhuma cobrança PIX gerada ainda
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.client_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-primary" />
                        R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusMap[p.status]?.variant || 'outline'}>
                        {statusMap[p.status]?.label || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.payment_id || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.created_at}</TableCell>
                    <TableCell className="text-right">
                      {p.qr_code && (
                        <Button size="sm" variant="ghost" onClick={() => copyPixCode(p.qr_code!)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                      {p.ticket_url && (
                        <Button size="sm" variant="ghost" onClick={() => window.open(p.ticket_url, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PagamentosPage;
