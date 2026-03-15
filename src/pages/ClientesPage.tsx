import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockClients } from '@/services/mock-data';
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
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
                  <TableCell>{client.phone}</TableCell>
                  <TableCell className="hidden sm:table-cell">{client.document}</TableCell>
                  <TableCell>{client.amount ? `R$ ${Number(client.amount).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{client.due_date ? new Date(client.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                      {client.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
