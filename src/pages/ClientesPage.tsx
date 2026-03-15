import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockClients, mockTemplates } from '@/services/mock-data';
import { Plus, Search, Pencil, Trash2, MessageCircle, CheckCircle } from 'lucide-react';
import type { Client } from '@/types/billing';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const ClientesPage = () => {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '55', phone2: '55', document: '', amount: '', due_date: '' });

  // Baixa manual state
  const [baixaDialogOpen, setBaixaDialogOpen] = useState(false);
  const [baixaClient, setBaixaClient] = useState<Client | null>(null);
  const [baixaMonths, setBaixaMonths] = useState('1');

  const normalizePhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return '55';
    if (digits.startsWith('55')) return `55${digits.slice(2, 13)}`;
    return `55${digits.slice(0, 11)}`;
  };

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.document.includes(search) ||
      c.phone.includes(search)
  );

  const handleSave = () => {
    if (!form.name || form.phone.length <= 2) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    const parsedData = {
      ...form,
      phone: normalizePhone(form.phone),
      phone2: form.phone2.length > 2 ? normalizePhone(form.phone2) : undefined,
      amount: form.amount ? parseFloat(form.amount) : undefined,
      due_date: form.due_date || undefined,
    };

    if (editingClient) {
      setClients((prev) =>
        prev.map((c) => (c.id === editingClient.id ? { ...c, ...parsedData, updated_at: new Date().toISOString() } : c))
      );
      toast.success('Cliente atualizado!');
    } else {
      const newClient: Client = {
        id: Date.now(),
        ...parsedData,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setClients((prev) => [...prev, newClient]);
      toast.success('Cliente adicionado!');
    }
    setDialogOpen(false);
    setEditingClient(null);
    setForm({ name: '', email: '', phone: '55', phone2: '55', document: '', amount: '', due_date: '' });
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email,
      phone: normalizePhone(client.phone || '55'),
      phone2: normalizePhone(client.phone2 || '55'),
      document: client.document,
      amount: client.amount?.toString() || '',
      due_date: client.due_date || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    toast.success('Cliente removido');
  };

  const getWhatsAppConfig = () => {
    const saved = localStorage.getItem('whatsapp_config');
    if (!saved) return null;
    try { return JSON.parse(saved); } catch { return null; }
  };

  const handleSendBilling = async (client: Client) => {
    if (!client.phone || client.phone.length <= 2) {
      toast.error('Cliente sem telefone cadastrado');
      return;
    }
    if (!client.amount) {
      toast.error('Cliente sem valor de cobrança definido');
      return;
    }
    const waConfig = getWhatsAppConfig();
    if (!waConfig?.api_url || !waConfig?.api_key || !waConfig?.instance_name) {
      toast.error('Configure o WhatsApp em Configurações primeiro');
      return;
    }
    try {
      toast.loading('Enviando cobrança...', { id: `billing-${client.id}` });
      const message = `Olá ${client.name}, segue sua cobrança no valor de R$ ${Number(client.amount).toFixed(2)}${client.due_date ? ` com vencimento em ${new Date(client.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}. Qualquer dúvida estamos à disposição!`;
      const { data, error } = await supabase.functions.invoke('evolution-proxy', {
        body: { action: 'send-text', to: client.phone, message, api_url: waConfig.api_url, api_key: waConfig.api_key, instance_name: waConfig.instance_name },
      });
      if (error) throw error;
      toast.success('Cobrança enviada via WhatsApp!', { id: `billing-${client.id}` });
    } catch (err) {
      toast.error('Erro ao enviar cobrança', { id: `billing-${client.id}` });
    }
  };

  const openBaixaDialog = (client: Client) => {
    setBaixaClient(client);
    setBaixaMonths('1');
    setBaixaDialogOpen(true);
  };

  const handleConfirmBaixa = async () => {
    if (!baixaClient) return;
    const months = parseInt(baixaMonths);

    // Advance due_date by N months
    let newDueDate = baixaClient.due_date;
    if (baixaClient.due_date) {
      const date = new Date(baixaClient.due_date + 'T00:00:00');
      date.setMonth(date.getMonth() + months);
      newDueDate = date.toISOString().split('T')[0];
    }

    setClients((prev) =>
      prev.map((c) =>
        c.id === baixaClient.id
          ? { ...c, due_date: newDueDate, updated_at: new Date().toISOString() }
          : c
      )
    );

    const totalAmount = (baixaClient.amount || 0) * months;
    toast.success(`Baixa de ${months} mês(es) - R$ ${totalAmount.toFixed(2)} registrada para ${baixaClient.name}`);

    // Send receipt via WhatsApp using the receipt template
    const waConfig = getWhatsAppConfig();
    if (baixaClient.phone && baixaClient.phone.length > 2 && waConfig?.api_url) {
      const receiptTemplate = mockTemplates.find((t) => t.type === 'receipt' && t.is_active);
      if (receiptTemplate) {
        const message = receiptTemplate.content
          .replace('{nome}', baixaClient.name)
          .replace('{valor}', `R$ ${totalAmount.toFixed(2)}`);

        try {
          toast.loading('Enviando recibo...', { id: `receipt-${baixaClient.id}` });
          const { error } = await supabase.functions.invoke('evolution-proxy', {
            body: { action: 'send-text', to: baixaClient.phone, message, api_url: waConfig.api_url, api_key: waConfig.api_key, instance_name: waConfig.instance_name },
          });
          if (error) throw error;
          toast.success('Recibo enviado via WhatsApp!', { id: `receipt-${baixaClient.id}` });
        } catch {
          toast.error('Erro ao enviar recibo', { id: `receipt-${baixaClient.id}` });
        }
      }
    }

    setBaixaDialogOpen(false);
    setBaixaClient(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingClient(null); setForm({ name: '', email: '', phone: '55', phone2: '55', document: '', amount: '', due_date: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value) })} placeholder="5511999990000" inputMode="numeric" />
              </div>
              <div>
                <Label>Telefone 2 <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: normalizePhone(e.target.value) })} placeholder="5511999990000" inputMode="numeric" />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="150.00" />
              </div>
              <div>
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog Baixa Manual */}
      <Dialog open={baixaDialogOpen} onOpenChange={setBaixaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixa Manual - {baixaClient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Vencimento atual: <strong>{baixaClient?.due_date ? new Date(baixaClient.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não definido'}</strong>
            </p>
            <div>
              <Label>Quantos meses dar baixa?</Label>
              <Select value={baixaMonths} onValueChange={setBaixaMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? 'mês' : 'meses'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {baixaClient?.due_date && (
              <p className="text-sm text-muted-foreground">
                Novo vencimento: <strong>
                  {(() => {
                    const d = new Date(baixaClient.due_date + 'T00:00:00');
                    d.setMonth(d.getMonth() + parseInt(baixaMonths));
                    return d.toLocaleDateString('pt-BR');
                  })()}
                </strong>
              </p>
            )}
            <p className="text-sm font-medium">
              Valor total da baixa: <strong className="text-primary">R$ {((baixaClient?.amount || 0) * parseInt(baixaMonths)).toFixed(2)}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Após confirmar, um recibo será enviado via WhatsApp.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBaixaDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleConfirmBaixa}>Confirmar Baixa</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="hidden sm:table-cell">CPF/CNPJ</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{client.email || '-'}</TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell className="hidden sm:table-cell">{client.document}</TableCell>
                  <TableCell>{client.amount ? `R$ ${Number(client.amount).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{client.due_date ? new Date(client.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                      {client.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" title="Enviar cobrança WhatsApp" onClick={() => handleSendBilling(client)}>
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Baixa manual" onClick={() => openBaixaDialog(client)}>
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientesPage;
