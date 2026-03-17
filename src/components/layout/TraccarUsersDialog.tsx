import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, User, Mail, Shield, ShieldCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { userStorageGet } from '@/services/auth';
import api from '@/services/api';

interface TraccarUser {
  id: number;
  name: string;
  email: string;
  administrator?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  deviceLimit?: number;
  expirationTime?: string;
}

interface TraccarUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TraccarUsersDialog({ open, onOpenChange }: TraccarUsersDialogProps) {
  const [users, setUsers] = useState<TraccarUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = userStorageGet('traccar_url');
        const user = userStorageGet('traccar_user');
        const pass = userStorageGet('traccar_password');
        if (!url || !user || !pass) {
          setError('Credenciais do Traccar não configuradas');
          return;
        }
        const res = await api.traccarProxy({ traccar_url: url, traccar_user: user, traccar_password: pass, endpoint: '/api/users', method: 'GET' });
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
    fetchUsers();
  }, [open]);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

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
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}

          {error && (
            <p className="text-sm text-destructive text-center py-4">{error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
          )}

          {!loading && filtered.map(u => (
            <div
              key={u.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/50',
                u.disabled && 'opacity-50'
              )}
            >
              <div className={cn(
                'flex items-center justify-center h-9 w-9 rounded-full shrink-0',
                u.administrator ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {u.administrator ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{u.name}</span>
                  {u.administrator && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">Admin</span>
                  )}
                  {u.disabled && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">Desativado</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{u.email}</span>
                </div>
              </div>
              {u.deviceLimit !== undefined && u.deviceLimit >= 0 && (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{u.deviceLimit} disp.</span>
              )}
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
