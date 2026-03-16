import { useState, useEffect } from 'react';
import {
  fetchBills, createBill, createBillChildren, updateBill, deleteBill, markBillPaid, getActiveDataBackend,
  type BillPayable,
} from '@/services/data-layer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Plus, Pencil, Trash2, CalendarIcon, DollarSign,
  Clock, CheckCircle, XCircle, AlertTriangle, Search, Filter
} from 'lucide-react';

const emptyForm = {
  description: '',
  supplier: '',
  category: '',
  payment_type: 'single' as 'single' | 'installment',
  total_amount: '',
  installments_count: '2',
  due_date: undefined as Date | undefined,
  notes: '',
};

const categories = [
  'Aluguel', 'Energia', 'Internet', 'Água', 'Telefone',
  'Software', 'Funcionários', 'Impostos', 'Material', 'Outros'
];

const FinanceiroPage = () => {
  const [bills, setBills] = useState<BillPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillPayable | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [saving, setSaving] = useState(false);

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = await fetchBills();
      setBills(data);
    } catch {
      toast.error('Erro ao carregar contas');
    }
    setLoading(false);
  };

  useEffect(() => { loadBills(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingBill(null);
  };

  const openEdit = (bill: BillPayable) => {
    setEditingBill(bill);
    setForm({
      description: bill.description,
      supplier: bill.supplier || '',
      category: bill.category || '',
      payment_type: bill.payment_type as 'single' | 'installment',
      total_amount: String(bill.total_amount),
      installments_count: String(bill.installments_count),
      due_date: bill.due_date ? parseISO(bill.due_date) : undefined,
      notes: bill.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error('Informe a descrição'); return; }
    if (!form.total_amount || Number(form.total_amount) <= 0) { toast.error('Informe o valor'); return; }
    if (!form.due_date) { toast.error('Informe a data de vencimento'); return; }

    setSaving(true);
    const totalAmount = Number(form.total_amount);
    const installments = form.payment_type === 'installment' ? Math.max(2, Number(form.installments_count) || 2) : 1;
    const installmentAmount = Math.round((totalAmount / installments) * 100) / 100;

    try {
      if (editingBill) {
        await updateBill(editingBill.id, {
          description: form.description.trim(),
          supplier: form.supplier.trim() || null,
          category: form.category || null,
          total_amount: totalAmount,
          amount: editingBill.payment_type === 'single' ? totalAmount : editingBill.amount,
          due_date: format(form.due_date, 'yyyy-MM-dd'),
          notes: form.notes.trim() || null,
        });
        toast.success('Conta atualizada!');
      } else if (form.payment_type === 'installment') {
        const parent = await createBill({
          description: form.description.trim(),
          supplier: form.supplier.trim() || null,
          category: form.category || null,
          payment_type: 'installment',
          total_amount: totalAmount,
          installments_count: installments,
          current_installment: 1,
          amount: installmentAmount,
          due_date: format(form.due_date, 'yyyy-MM-dd'),
          notes: form.notes.trim() || null,
        });

        if (parent) {
          const children = [];
          for (let i = 1; i < installments; i++) {
            const dueDate = new Date(form.due_date);
            dueDate.setMonth(dueDate.getMonth() + i);
            children.push({
              description: form.description.trim(),
              supplier: form.supplier.trim() || null,
              category: form.category || null,
              payment_type: 'installment',
              total_amount: totalAmount,
              installments_count: installments,
              current_installment: i + 1,
              parent_bill_id: parent.id,
              amount: i === installments - 1
                ? Math.round((totalAmount - installmentAmount * (installments - 1)) * 100) / 100
                : installmentAmount,
              due_date: format(dueDate, 'yyyy-MM-dd'),
              notes: form.notes.trim() || null,
            });
          }
          if (children.length > 0) await createBillChildren(children);
        }
        toast.success(`Conta parcelada criada em ${installments}x!`);
      } else {
        await createBill({
          description: form.description.trim(),
          supplier: form.supplier.trim() || null,
          category: form.category || null,
          payment_type: 'single',
          total_amount: totalAmount,
          installments_count: 1,
          current_installment: 1,
          amount: totalAmount,
          due_date: format(form.due_date, 'yyyy-MM-dd'),
          notes: form.notes.trim() || null,
        });
        toast.success('Conta criada!');
      }

      setDialogOpen(false);
      resetForm();
      loadBills();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteBill(id);
      toast.success('Conta excluída');
      loadBills();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleMarkPaid = async (bill: BillPayable) => {
    try {
      await markBillPaid(bill.id);
      toast.success('Marcada como paga!');
      loadBills();
    } catch {
      toast.error('Erro ao marcar como paga');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pendente', variant: 'outline' },
      paid: { label: 'Paga', variant: 'default' },
      overdue: { label: 'Vencida', variant: 'destructive' },
      cancelled: { label: 'Cancelada', variant: 'secondary' },
    };
    const s = map[status] || map.pending;
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const filtered = bills.filter((b) => {
    const matchSearch = !search ||
      b.description.toLowerCase().includes(search.toLowerCase()) ||
      (b.supplier || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPending = filtered.filter(b => b.status === 'pending').reduce((s, b) => s + Number(b.amount), 0);
  const totalPaid = filtered.filter(b => b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0);
  const totalOverdue = filtered.filter(b => b.status === 'overdue').reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-warning/10 p-2.5">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-lg font-bold">R$ {totalPending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-accent/10 p-2.5">
              <CheckCircle className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagas</p>
              <p className="text-lg font-bold">R$ {totalPaid.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-full bg-destructive/10 p-2.5">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-lg font-bold">R$ {totalOverdue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Contas a Pagar
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingBill ? 'Editar Conta' : 'Nova Conta a Pagar'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Descrição *</Label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel escritório" maxLength={255} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Fornecedor</Label>
                      <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Nome do fornecedor" maxLength={255} />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {!editingBill && (
                    <div>
                      <Label>Tipo de Pagamento</Label>
                      <Select value={form.payment_type} onValueChange={v => setForm({ ...form, payment_type: v as 'single' | 'installment' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Vencimento Único</SelectItem>
                          <SelectItem value="installment">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor Total (R$) *</Label>
                      <Input type="number" step="0.01" min="0.01" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} placeholder="0,00" />
                    </div>
                    {form.payment_type === 'installment' && !editingBill && (
                      <div>
                        <Label>Nº de Parcelas</Label>
                        <Input type="number" min="2" max="60" value={form.installments_count} onChange={e => setForm({ ...form, installments_count: e.target.value })} />
                      </div>
                    )}
                  </div>

                  {form.payment_type === 'installment' && !editingBill && form.total_amount && (
                    <p className="text-sm text-muted-foreground">
                      {Number(form.installments_count) || 2}x de R$ {(Number(form.total_amount) / (Number(form.installments_count) || 2)).toFixed(2)}
                    </p>
                  )}

                  <div>
                    <Label>{form.payment_type === 'installment' && !editingBill ? 'Vencimento da 1ª Parcela *' : 'Data de Vencimento *'}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.due_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.due_date ? format(form.due_date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.due_date} onSelect={d => setForm({ ...form, due_date: d })} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anotações opcionais" maxLength={500} rows={2} />
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? 'Salvando...' : editingBill ? 'Atualizar' : 'Criar Conta'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por descrição ou fornecedor..." className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma conta encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{bill.description}</TableCell>
                      <TableCell>{bill.supplier || '-'}</TableCell>
                      <TableCell>{bill.category || '-'}</TableCell>
                      <TableCell>
                        {bill.payment_type === 'installment'
                          ? <span className="text-xs">{bill.installments_count}x</span>
                          : <span className="text-xs">Único</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono">R$ {Number(bill.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        {bill.due_date ? format(parseISO(bill.due_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>{statusBadge(bill.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {bill.status === 'pending' && (
                            <Button variant="ghost" size="icon" title="Marcar como paga" onClick={() => handleMarkPaid(bill)}>
                              <CheckCircle className="h-4 w-4 text-accent" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(bill)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Excluir">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {bill.payment_type === 'installment'
                                    ? 'Todas as parcelas serão excluídas. Esta ação não pode ser desfeita.'
                                    : 'Esta ação não pode ser desfeita.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(bill.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroPage;
