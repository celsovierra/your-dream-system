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
  DollarSign,
  ScrollText,
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
  { path: '/logs', label: 'Logs', icon: ScrollText, color: 'text-cyan-400' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, color: 'text-rose-400' },
];

const AppLayout = ({ children, onLogout }: LayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [deploying, setDeploying] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [lastDeployAt, setLastDeployAt] = useState<string | null>(() => localStorage.getItem('last_deploy_at'));
  const [deployCheckError, setDeployCheckError] = useState<string | null>(null);

  function isLovableHost() {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname.toLowerCase();
    return hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com');
  }

  function getConfiguredDeployApiUrl() {
    if (typeof window === 'undefined') return '';

    const envApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
    const storedApiBaseUrl = window.localStorage.getItem('api_base_url')?.trim();
    const configuredApiBaseUrl = storedApiBaseUrl || envApiBaseUrl;

    if (!configuredApiBaseUrl) return '';

    const normalized = configuredApiBaseUrl.replace(/\/+$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  const deployApiConfigured = !isLovableHost() || Boolean(getConfiguredDeployApiUrl());

  function resolveDeployApiUrl() {
    if (typeof window === 'undefined') return '';
    return isLovableHost() ? getConfiguredDeployApiUrl() : `${window.location.origin}/api`;
  }

  async function parseApiResponse(response: Response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text().catch(() => '');
    return {
      success: false,
      error: text ? text.slice(0, 160) : `Erro ${response.status}`,
    };
  }

  const checkForUpdates = async () => {
    const apiUrl = resolveDeployApiUrl();

    if (!apiUrl) {
      setHasUpdate(false);
      setDeployCheckError(null);
      return null;
    }

    try {
      const res = await fetch(`${apiUrl}/check-update?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await parseApiResponse(res);

      if (res.ok && data.success) {
        setHasUpdate(Boolean(data.hasUpdate));
        setDeployCheckError(null);
        if (data.lastCommitDate) {
          localStorage.setItem('last_deploy_at', data.lastCommitDate);
          setLastDeployAt(data.lastCommitDate);
        }
        return data;
      }

      setHasUpdate(false);
      setDeployCheckError(data.error || 'Não foi possível verificar atualizações');
      return null;
    } catch (error) {
      setHasUpdate(false);
      setDeployCheckError(error instanceof Error ? error.message : 'Não foi possível verificar atualizações');
      return null;
    }
  };

  const waitForDeployCompletion = async (apiUrl: string, previousRemoteCommit?: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 3 ? 2000 : 3000));

      const checkData = await checkForUpdates();
      if (!checkData) {
        continue;
      }

      const localCommit = checkData.localCommit;
      const remoteCommit = checkData.remoteCommit;
      const updated = !checkData.hasUpdate && Boolean(localCommit) && localCommit === remoteCommit;
      const remoteChanged = Boolean(previousRemoteCommit && remoteCommit && remoteCommit !== previousRemoteCommit);

      if (updated || remoteChanged) {
        const completedAt = checkData.lastCommitDate || new Date().toISOString();
        localStorage.setItem('last_deploy_at', completedAt);
        setLastDeployAt(completedAt);
        setHasUpdate(false);
        setDeployCheckError(null);
        toast.success('Atualização concluída com sucesso. Recarregando...');
        setTimeout(() => window.location.reload(), 1200);
        return true;
      }
    }

    toast.warning('O deploy foi iniciado, mas ainda não consegui confirmar a atualização no Git da VPS.');
    return false;
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const syncDeployApi = () => {
      void checkForUpdates();
    };

    syncDeployApi();
    const interval = setInterval(syncDeployApi, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleDeploy = async () => {
    const apiUrl = resolveDeployApiUrl();

    if (!apiUrl) {
      toast.error('Abra o sistema na VPS para executar a atualização.');
      return;
    }

    const beforeDeploy = await checkForUpdates();
    const previousRemoteCommit = beforeDeploy?.remoteCommit;

    setDeploying(true);

    try {
      const res = await fetch(`${apiUrl}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-deploy-token': 'cobranca-deploy-2024',
        },
      });

      const data = await parseApiResponse(res);

      if (!res.ok || !data.success) {
        toast.error(data.error || 'Erro ao iniciar a atualização da VPS');
        return;
      }

      toast.success(data.message || 'Atualização iniciada com sucesso.');
      await waitForDeployCompletion(apiUrl, previousRemoteCommit);
    } catch {
      toast.error('Não foi possível conectar à API da VPS');
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
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all lg:static lg:translate-x-0',
          sidebarCollapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
          <div className={cn("flex items-center gap-2", sidebarCollapsed && "justify-center w-full")}>
            <Receipt className="h-7 w-7 shrink-0 text-sidebar-primary" />
            {!sidebarCollapsed && (
              <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
                CobrançaPro
              </span>
            )}
          </div>
        </div>

        {/* Collapse/expand toggle - outside sidebar edge */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute top-5 -right-3.5 z-50 hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:bg-accent hover:text-accent-foreground transition-all duration-200"
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-md py-2.5 text-sm font-medium transition-colors',
                  sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-sidebar-primary-foreground" : item.color)} />
                {!sidebarCollapsed && item.label}
              </Link>
            );
          })}
        </nav>


        {!sidebarCollapsed && (
          <div className="border-t border-sidebar-border p-4 space-y-3">
            <div className="relative">
              {hasUpdate && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
              )}
              <button
                onClick={handleDeploy}
                disabled={deploying || !deployApiConfigured}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200",
                  hasUpdate
                    ? "bg-gradient-to-r from-warning to-destructive text-destructive-foreground shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    : deployApiConfigured
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  "disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                )}
              >
                <RefreshCw className={cn("h-4 w-4 shrink-0", deploying && "animate-spin")} />
                <span>
                  {deploying
                    ? 'Atualizando...'
                    : !deployApiConfigured
                      ? 'Use na VPS'
                      : hasUpdate
                        ? 'Atualização disponível!'
                        : 'Atualizar VPS'}
                </span>
              </button>
            </div>
            <p className="text-[11px] text-sidebar-foreground/50 text-center">
              {!deployApiConfigured
                ? '⚙️ Esse botão funciona na instalação da VPS'
                : deployCheckError
                  ? `⚠️ Falha ao verificar: ${deployCheckError}`
                  : hasUpdate
                    ? '🔴 Nova versão disponível'
                    : lastDeployAt
                      ? `✅ Atualizado em ${new Date(lastDeployAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : '✅ Nenhuma atualização disponível'}
            </p>
          </div>
        )}
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
              {location.pathname === '/financeiro' ? 'Financeiro' : navItems.find((i) => i.path === location.pathname)?.label || 'Sistema de Cobrança'}
            </h2>
            {(location.pathname === '/' || location.pathname === '/financeiro') ? (
              <div className="flex items-center gap-1">
                <Link
                  to="/"
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    location.pathname === '/'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/financeiro"
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    location.pathname === '/financeiro'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <DollarSign className="h-4 w-4" />
                  Financeiro
                </Link>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Modo claro' : 'Modo escuro'}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {onLogout && (
              <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
