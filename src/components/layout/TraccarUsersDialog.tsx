import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, User, Mail, ShieldCheck, Pencil, Plug, X, Save, Loader2, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import { userStorageGet } from '@/services/auth';
import api from '@/services/api';
import { toast } from 'sonner';

interface TraccarUser {
  id: number;
  name: string;
  email: string;
  administrator?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  deviceLimit?: number;
  expirationTime?: string;
  phone?: string;
}

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
}

interface TraccarUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = 'list' | 'edit' | 'connection';

export default function TraccarUsersDialog({ open, onOpenChange }: TraccarUsersDialogProps) {
  const [users, setUsers] = useState<TraccarUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedUser, setSelectedUser] = useState<TraccarUser | null>(null);
  const [editForm, setEditForm] = useState<Partial<TraccarUser>>({});

  // Connection state
  const [allDevices, setAllDevices] = useState<TraccarDevice[]>([]);
  const [linkedDeviceIds, setLinkedDeviceIds] = useState<Set<number>>(new Set());
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [togglingDevice, setTogglingDevice] = useState<number | null>(null);
  const [deviceSearch, setDeviceSearch] = useState('');

  const getCredentials = () => {
    const url = userStorageGet('traccar_url');
    const user = userStorageGet('traccar_user');
    const pass = userStorageGet('traccar_password');
    if (!url || !user || !pass) return null;
    return { traccar_url: url, traccar_user: user, traccar_password: pass };
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const creds = getCredentials();
      if (!creds) { setError('Credenciais do Traccar não configuradas'); return; }
      const res = await api.traccarProxy({ ...creds, endpoint: '/api/users', method: 'GET' });
      if (res.success && res.data?.data) {
        setUsers(res.data.data);
      } else {
        setError(res.error || 'Erro ao buscar usuários');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) { setViewMode('list'); setSelectedUser(null); return; }
    fetchUsers();
  }, [open]);

  const handleEdit = (u: TraccarUser) => {
    setSelectedUser(u);
    setEditForm({ name: u.name, email: u.email, phone: u.phone || '', deviceLimit: u.deviceLimit, disabled: u.disabled });
    setViewMode('edit');
  };

  const handleConnection = async (u: TraccarUser) => {
    setSelectedUser(u);
    setViewMode('connection');
    setDeviceSearch('');
    setLoadingDevices(true);

    const creds = getCredentials();
    if (!creds) { setLoadingDevices(false); return; }

    try {
      // Fetch all devices and user's linked devices in parallel
      const [allRes, userDevicesRes] = await Promise.all([
        api.traccarProxy({ ...creds, endpoint: '/api/devices', method: 'GET' }),
        api.traccarProxy({ ...creds, endpoint: `/api/devices?userId=${u.id}`, method: 'GET' }),
      ]);

      if (allRes.success && allRes.data?.data) {
        setAllDevices(allRes.data.data);
      }
      if (userDevicesRes.success && userDevicesRes.data?.data) {
        setLinkedDeviceIds(new Set(userDevicesRes.data.data.map((d: TraccarDevice) => d.id)));
      }
    } catch {
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleToggleDevice = async (deviceId: number) => {
    if (!selectedUser) return;
    const creds = getCredentials();
    if (!creds) return;

    const isLinked = linkedDeviceIds.has(deviceId);
    setTogglingDevice(deviceId);

    try {
      const res = await api.traccarProxy({
        ...creds,
        endpoint: '/api/permissions',
        method: isLinked ? 'DELETE' : 'POST',
        body: { userId: selectedUser.id, deviceId },
      });

      if (res.success) {
        setLinkedDeviceIds(prev => {
          const next = new Set(prev);
          if (isLinked) next.delete(deviceId); else next.add(deviceId);
          return next;
        });
        toast.success(isLinked ? 'Veículo desvinculado' : 'Veículo vinculado');
      } else {
        toast.error(res.error || 'Erro ao alterar vínculo');
      }
    } catch {
      toast.error('Erro ao alterar vínculo');
    } finally {
      setTogglingDevice(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    const creds = getCredentials();
    if (!creds) { toast.error('Credenciais não configuradas'); return; }

    setSaving(true);
    try {
      const res = await api.traccarProxy({
        ...creds,
        endpoint: `/api/users/${selectedUser.id}`,
        method: 'PUT',
        body: { ...selectedUser, ...editForm },
      });
      if (res.success) {
        toast.success('Usuário atualizado com sucesso');
        setViewMode('list');
        fetchUsers();
      } else {
        toast.error(res.error || 'Erro ao atualizar usuário');
      }
    } catch {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDevices = allDevices.filter(d =>
    d.name?.toLowerCase().includes(deviceSearch.toLowerCase()) ||
    d.uniqueId?.toLowerCase().includes(deviceSearch.toLowerCase())
  );

  // ===== EDIT VIEW =====
  if (viewMode === 'edit' && selectedUser) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Limite de dispositivos</Label>
              <Input type="number" value={editForm.deviceLimit ?? -1} onChange={e => setEditForm(f => ({ ...f, deviceLimit: parseInt(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">-1 = ilimitado</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Desativado</Label>
              <Switch checked={editForm.disabled || false} onCheckedChange={v => setEditForm(f => ({ ...f, disabled: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewMode('list')}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== CONNECTION VIEW (vincular veículos) =====
  if (viewMode === 'connection' && selectedUser) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              Veículos — {selectedUser.name}
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-2">
            Marque os veículos que deseja vincular a este usuário.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar veículo..." value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
            {loadingDevices && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}

            {!loadingDevices && filteredDevices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum veículo encontrado</p>
            )}

            {!loadingDevices && [...filteredDevices].sort((a, b) => {
              const aLinked = linkedDeviceIds.has(a.id) ? 0 : 1;
              const bLinked = linkedDeviceIds.has(b.id) ? 0 : 1;
              return aLinked - bLinked;
            }).map(d => {
              const isLinked = linkedDeviceIds.has(d.id);
              const isToggling = togglingDevice === d.id;
              return (
                <div
                  key={d.id}
                  onClick={() => !isToggling && handleToggleDevice(d.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                    isLinked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-accent/50'
                  )}
                >
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <Checkbox checked={isLinked} className="shrink-0 pointer-events-none" />
                  )}
                  <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.uniqueId}</span>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded',
                    d.status === 'online' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                  )}>
                    {d.status === 'online' ? 'Online' : d.status === 'offline' ? 'Offline' : d.status}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {linkedDeviceIds.size} vinculado(s) de {allDevices.length}
            </p>
            <Button variant="outline" size="sm" onClick={() => setViewMode('list')}>
              <X className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== LIST VIEW =====
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Usuários Traccar
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
          {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          {error && <p className="text-sm text-destructive text-center py-4">{error}</p>}
          {!loading && !error && filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>}

          {!loading && filtered.map(u => (
            <div key={u.id} className={cn('flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50', u.disabled && 'opacity-50')}>
              <div className={cn('flex items-center justify-center h-9 w-9 rounded-full shrink-0', u.administrator ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                {u.administrator ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{u.name}</span>
                  {u.administrator && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">Admin</span>}
                  {u.disabled && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Desativado</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{u.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleConnection(u)} title="Vincular veículos" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Plug className="h-4 w-4" />
                </button>
                <button onClick={() => handleEdit(u)} title="Editar" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-1">
          {!loading && !error && `${filtered.length} usuário(s)`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
