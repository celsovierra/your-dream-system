import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Pencil, Trash2, Eye, EyeOff, Shield, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchUsersVps, registerVps, updateUserVps, deleteUserVps, type AppUser } from '@/services/auth';

const ALL_PERMISSIONS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'fila', label: 'Fila' },
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'logs', label: 'Logs' },
];

interface UserForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  client_limit: number;
  expires_at: string;
  permissions: string[];
}

const emptyForm: UserForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  client_limit: 0,
  expires_at: '',
  permissions: ALL_PERMISSIONS.map(p => p.key),
};

export default function UserManagementSection() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchUsersVps();
      setUsers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      client_limit: user.client_limit || 0,
      expires_at: user.expires_at ? user.expires_at.split('T')[0] : '',
      permissions: user.permissions || ALL_PERMISSIONS.map(p => p.key),
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }
    if (!editingUser && !form.password) {
      toast.error('Senha é obrigatória para novos usuários');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const updateData: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          client_limit: form.client_limit,
          expires_at: form.expires_at || null,
          permissions: form.permissions,
        };
        if (form.password) updateData.password = form.password;
        await updateUserVps(editingUser.id, updateData as any);
        toast.success('Usuário atualizado!');
      } else {
        await registerVps({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          client_limit: form.client_limit,
          expires_at: form.expires_at || null,
          permissions: form.permissions,
        });
        toast.success('Usuário criado!');
      }
      setDialogOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!confirm(`Remover "${user.name}"?`)) return;
    try {
      await deleteUserVps(user.id);
      toast.success('Usuário removido');
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  const togglePermission = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const isExpired = (date: string | null | undefined) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <CardContent className="pt-0 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os usuários do sistema</p>
        <Button size="sm" onClick={openCreate}>
          <UserPlus className="h-4 w-4 mr-1" /> Novo Usuário
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-center">Limite</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {user.role === 'admin' ? <Shield className="h-4 w-4 text-amber-500" /> : <User className="h-4 w-4 text-muted-foreground" />}
                      {user.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.phone || '—'}</TableCell>
                  <TableCell className="text-center">{user.client_limit || '∞'}</TableCell>
                  <TableCell>
                    {user.expires_at ? (
                      <Badge variant={isExpired(user.expires_at) ? 'destructive' : 'secondary'} className="text-xs">
                        {new Date(user.expires_at).toLocaleDateString('pt-BR')}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Ilimitado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className="text-xs">
                      {user.role === 'admin' ? 'Admin' : 'Usuário'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== 'admin' && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(user)} title="Remover" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(99) 99999-9999" />
              </div>
            </div>

            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@email.com" />
            </div>

            <div>
              <Label>{editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={editingUser ? '••••••' : 'Mínimo 4 caracteres'}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Limite de Clientes</Label>
                <Input type="number" min={0} value={form.client_limit} onChange={e => setForm(p => ({ ...p, client_limit: Number(e.target.value) }))} />
                <p className="text-[11px] text-muted-foreground mt-1">0 = ilimitado</p>
              </div>
              <div>
                <Label>Data de Validade</Label>
                <Input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
                <p className="text-[11px] text-muted-foreground mt-1">Vazio = sem expiração</p>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Permissões de Acesso</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map(perm => (
                  <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                    <Checkbox
                      checked={form.permissions.includes(perm.key)}
                      onCheckedChange={() => togglePermission(perm.key)}
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingUser ? 'Salvar' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  );
}
