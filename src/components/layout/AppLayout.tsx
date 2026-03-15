import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  LayoutDashboard,
  Users,
  MessageSquare,
  ListTodo,
  FileText,
  Settings,
  Menu,
  Receipt,
  RefreshCw,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-400' },
  { path: '/clientes', label: 'Clientes', icon: Users, color: 'text-emerald-400' },
  
  { path: '/fila', label: 'Fila de Envio', icon: ListTodo, color: 'text-purple-400' },
  { path: '/mensagens', label: 'Mensagens', icon: MessageSquare, color: 'text-green-400' },
  { path: '/contratos', label: 'Contratos', icon: FileText, color: 'text-orange-400' },
  
  { path: '/configuracoes', label: 'Configurações', icon: Settings, color: 'text-rose-400' },
];

const AppLayout = ({ children, onLogout }: LayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [deploying, setDeploying] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const savedUrl = localStorage.getItem('api_base_url');
        const autoUrl = `${window.location.origin}/api`;
        const apiUrl = savedUrl || autoUrl;
        const res = await fetch(`${apiUrl}/check-update`);
        const data = await res.json();
        if (data.success) {
          setHasUpdate(data.hasUpdate);
        }
      } catch {
        // silently fail
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60000); // verifica a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  const handleDeploy = async () => {
    // Auto-detecta a URL da API baseado no endereço atual do navegador
    const savedUrl = localStorage.getItem('api_base_url');
    const autoUrl = `${window.location.origin}/api`;
    const apiUrl = savedUrl || autoUrl;

    setDeploying(true);
    try {
      const res = await fetch(`${apiUrl}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-deploy-token': 'cobranca-deploy-2024',
        },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Deploy iniciado! O sistema será atualizado em instantes.');
      } else {
        toast.error(data.error || 'Erro ao iniciar deploy');
      }
    } catch {
      toast.error('Não foi possível conectar ao servidor');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Receipt className="h-7 w-7 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
            CobrançaPro
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-sidebar-primary-foreground" : item.color)} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="relative">
            {hasUpdate && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
            <button
              onClick={() => { handleDeploy(); setHasUpdate(false); }}
              disabled={deploying || !hasUpdate}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200",
                hasUpdate
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
                "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              )}
            >
              <RefreshCw className={cn("h-4 w-4 shrink-0", deploying && "animate-spin")} />
              <span>{deploying ? 'Atualizando...' : hasUpdate ? 'Atualização disponível!' : 'VPS atualizada'}</span>
            </button>
          </div>
          <p className="text-[11px] text-sidebar-foreground/50 text-center">
            {hasUpdate ? '🔴 Nova versão disponível' : '✅ Nenhuma atualização disponível'}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-card-foreground">
              {navItems.find((i) => i.path === location.pathname)?.label || 'Sistema de Cobrança'}
            </h2>
          </div>
          {onLogout && (
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
