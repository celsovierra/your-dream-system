import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SidebarVehicles, { type TraccarDevice, type TraccarPosition } from './SidebarVehicles';
import VehicleMapView from './VehicleMapView';
import { Button } from '@/components/ui/button';
import { isAdmin } from '@/services/auth';
import {
  LogOut,
  LayoutDashboard,
  Users,
  UserCircle,
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
import TraccarUsersDialog from './TraccarUsersDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
}

const headerNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-400' },
  { path: '/clientes', label: 'Clientes', icon: Users, color: 'text-emerald-400' },
  { path: '/fila', label: 'Fila', icon: ListTodo, color: 'text-purple-400' },
  { path: '/mensagens', label: 'Mensagens', icon: MessageSquare, color: 'text-green-400' },
  { path: '/contratos', label: 'Contratos', icon: FileText, color: 'text-orange-400' },
  { path: '/financeiro', label: 'Contas', icon: DollarSign, color: 'text-yellow-400' },
];

const navItems = [
  { path: '/', label: 'Financeiro', icon: DollarSign, color: 'text-yellow-400' },
];

const allBottomNavItems: { path: string; label: string; icon: any; color: string }[] = [];

const AppLayout = ({ children, onLogout }: LayoutProps) => {
  const userIsAdmin = isAdmin();
  const bottomNavItems = allBottomNavItems;
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [deploying, setDeploying] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{ device: TraccarDevice; position?: TraccarPosition } | null>(null);
  const [hasAutoOpenedMap, setHasAutoOpenedMap] = useState(false);
  const [showTraccarUsers, setShowTraccarUsers] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [lastDeployAt, setLastDeployAt] = useState<string | null>(() => localStorage.getItem('last_deploy_at'));
  const [deployCheckError, setDeployCheckError] = useState<string | null>(null);
  const showVehicleMap = location.pathname === '/' && Boolean(selectedVehicle);

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

  // Proxy-aware fetch: routes through edge function when on HTTPS calling HTTP VPS
  async function proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const isHttps = window.location.protocol === 'https:';
    const isTargetHttp = url.startsWith('http://');

    if (isHttps && isTargetHttp) {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'pmnanfzbtimcfyzndeyq';
      const proxyBase = `https://${projectId}.supabase.co/functions/v1/vps-proxy`;
      
      // Extract base and endpoint from URL
      const apiUrl = resolveDeployApiUrl();
      const endpoint = url.replace(apiUrl, '');
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

      return fetch(`${proxyBase}?vps_url=${encodeURIComponent(apiUrl)}&endpoint=${encodeURIComponent(endpoint)}`, {
        ...options,
        headers: {
          ...(options.headers as Record<string, string> || {}),
          'apikey': anonKey,
        },
      });
    }

    return fetch(url, options);
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
      const res = await proxyFetch(`${apiUrl}/check-update?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await parseApiResponse(res);

      if (res.ok && data.success) {
        setHasUpdate(Boolean(data.hasUpdate));
        setDeployCheckError(null);

        if (data.runningStartedAt) {
          localStorage.setItem('last_deploy_at', data.runningStartedAt);
          setLastDeployAt(data.runningStartedAt);
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

  const waitForDeployCompletion = async (previousRunningCommit?: string, previousRunningStartedAt?: string | null) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt < 3 ? 2000 : 3000));

      const checkData = await checkForUpdates();
      if (!checkData) {
        continue;
      }

      const runningCommit = checkData.runningCommit;
      const remoteCommit = checkData.remoteCommit;
      const runningStartedAt = checkData.runningStartedAt;
      const commitMatchesRemote = Boolean(runningCommit) && Boolean(remoteCommit) && runningCommit === remoteCommit;
      const processRestarted = Boolean(runningStartedAt) && runningStartedAt !== previousRunningStartedAt;
      const commitChanged = Boolean(previousRunningCommit) && Boolean(runningCommit) && runningCommit !== previousRunningCommit;

      if (commitMatchesRemote && (processRestarted || commitChanged)) {
        localStorage.setItem('deploy_pending', 'true');
        setHasUpdate(false);
        setDeployCheckError(null);

        if (runningStartedAt) {
          localStorage.setItem('last_deploy_at', runningStartedAt);
          setLastDeployAt(runningStartedAt);
        }

        toast.success('Atualização concluída com sucesso. Recarregando...');
        setTimeout(() => window.location.reload(), 1200);
        return true;
      }
    }

    toast.warning('O deploy foi iniciado, mas ainda não consegui confirmar a atualização real da VPS.');
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
    if (location.pathname !== '/' && selectedVehicle) {
      setSelectedVehicle(null);
    }
  }, [location.pathname, selectedVehicle]);

  useEffect(() => {
    const confirmPendingDeploy = async () => {
      const pending = localStorage.getItem('deploy_pending');
      if (pending) {
        const data = await checkForUpdates();
        if (data && !data.hasUpdate && data.runningStartedAt) {
          localStorage.setItem('last_deploy_at', data.runningStartedAt);
          localStorage.removeItem('deploy_pending');
          setLastDeployAt(data.runningStartedAt);
          return;
        }

        localStorage.removeItem('deploy_pending');
      }
    };

    const syncDeployApi = () => {
      void checkForUpdates();
    };

    confirmPendingDeploy().then(() => {
      syncDeployApi();
    });
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
    const previousRunningCommit = beforeDeploy?.runningCommit;
    const previousRunningStartedAt = beforeDeploy?.runningStartedAt ?? null;

    setDeploying(true);

    try {
      const res = await proxyFetch(`${apiUrl}/deploy`, {
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
      await waitForDeployCompletion(previousRunningCommit, previousRunningStartedAt);
    } catch {
      toast.error('Não foi possível conectar à API da VPS');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="relative flex h-screen overflow-hidden">
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
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all lg:static lg:translate-x-0 overflow-visible',
          sidebarCollapsed ? 'w-16' : 'w-[400px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Collapsed: expand button at very top */}
        {sidebarCollapsed && (
          <div className="flex items-center justify-center py-3 border-b border-sidebar-border">
            <button
              onClick={() => { setSidebarCollapsed(false); setSelectedVehicle(null); setHasAutoOpenedMap(false); }}
              title="Expandir menu"
              className="flex items-center justify-center rounded-xl h-10 w-10 transition-all duration-300 bg-gradient-to-b from-sidebar-primary/80 to-sidebar-primary text-white shadow-lg hover:shadow-sidebar-primary/40 hover:scale-110 active:scale-95"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className={cn("flex items-center border-b border-sidebar-border px-3 gap-2", sidebarCollapsed ? "h-auto py-2 justify-center" : "h-16")}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {(() => {
                const customLogo = localStorage.getItem('layout_logo');
                return customLogo
                  ? <img src={customLogo} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
                  : <Receipt className="h-7 w-7 shrink-0 text-sidebar-primary" />;
              })()}
              <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground truncate">
                {localStorage.getItem('layout_company_name') || 'CobrançaPro'}
              </span>
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="flex shrink-0 gap-1.5 items-center">
              <Link
                to="/configuracoes"
                onClick={() => { setSidebarOpen(false); setSelectedVehicle(null); setSidebarCollapsed(true); setHasAutoOpenedMap(true); }}
                title="Configurações"
                className={cn(
                  'flex items-center justify-center rounded-lg h-9 w-9 shrink-0 transition-all duration-200',
                  location.pathname === '/configuracoes'
                    ? 'bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-[0_4px_6px_-1px_rgba(244,63,94,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] scale-105'
                    : 'bg-gradient-to-b from-rose-500/80 to-rose-700/80 text-white/90 shadow-[0_2px_4px_-1px_rgba(244,63,94,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:from-rose-400 hover:to-rose-600 hover:scale-105 active:scale-95'
                )}
              >
                <Settings className="h-5 w-5 drop-shadow-sm" />
              </Link>
              <button
                onClick={() => { setShowTraccarUsers(true); setSidebarCollapsed(true); }}
                title="Usuários Traccar"
                className="flex items-center justify-center rounded-lg h-9 w-9 shrink-0 transition-all duration-200 bg-gradient-to-b from-sky-500/80 to-sky-700/80 text-white/90 shadow-[0_2px_4px_-1px_rgba(14,165,233,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:from-sky-400 hover:to-sky-600 hover:scale-105 active:scale-95"
              >
                <UserCircle className="h-5 w-5 drop-shadow-sm" />
              </button>
              <Link
                to="/"
                onClick={() => { setSidebarOpen(false); setSelectedVehicle(null); setSidebarCollapsed(true); setHasAutoOpenedMap(true); }}
                title="Financeiro"
                className={cn(
                  'flex items-center justify-center rounded-lg h-9 w-9 shrink-0 transition-all duration-200',
                  (location.pathname === '/' || location.pathname === '/financeiro') && !selectedVehicle
                    ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_4px_6px_-1px_rgba(16,185,129,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] scale-105'
                    : 'bg-gradient-to-b from-emerald-500/80 to-emerald-700/80 text-white/90 shadow-[0_2px_4px_-1px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] hover:from-emerald-400 hover:to-emerald-600 hover:scale-105 active:scale-95'
                )}
              >
                <DollarSign className="h-5 w-5 drop-shadow-sm" />
              </Link>
            </div>
          )}
        </div>

        {/* Collapsed icon buttons */}
        {sidebarCollapsed && (
          <div className="flex flex-col items-center gap-2 py-3 border-b border-sidebar-border">
            <Link
              to="/configuracoes"
              onClick={() => { setSidebarOpen(false); setSelectedVehicle(null); }}
              title="Configurações"
              className={cn(
                'flex items-center justify-center rounded-lg h-8 w-8 transition-all duration-200',
                location.pathname === '/configuracoes'
                  ? 'bg-gradient-to-b from-rose-400 to-rose-600 text-white scale-105'
                  : 'bg-gradient-to-b from-rose-500/80 to-rose-700/80 text-white/90 hover:from-rose-400 hover:to-rose-600 hover:scale-105 active:scale-95'
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setShowTraccarUsers(true)}
              title="Usuários Traccar"
              className="flex items-center justify-center rounded-lg h-8 w-8 transition-all duration-200 bg-gradient-to-b from-sky-500/80 to-sky-700/80 text-white/90 hover:from-sky-400 hover:to-sky-600 hover:scale-105 active:scale-95"
            >
              <UserCircle className="h-4 w-4" />
            </button>
            <Link
              to="/"
              onClick={() => { setSidebarOpen(false); setSelectedVehicle(null); setSidebarCollapsed(true); setHasAutoOpenedMap(true); }}
              title="Financeiro"
              className={cn(
                'flex items-center justify-center rounded-lg h-8 w-8 transition-all duration-200',
                (location.pathname === '/' || location.pathname === '/financeiro') && !selectedVehicle
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white scale-105'
                  : 'bg-gradient-to-b from-emerald-500/80 to-emerald-700/80 text-white/90 hover:from-emerald-400 hover:to-emerald-600 hover:scale-105 active:scale-95'
              )}
            >
              <DollarSign className="h-4 w-4" />
            </Link>
          </div>
        )}

        <nav className={cn("flex-1 overflow-y-auto p-2", sidebarCollapsed && "hidden")}>
          <SidebarVehicles
            collapsed={sidebarCollapsed}
            autoSelectFirst={location.pathname === '/' && !hasAutoOpenedMap}
            selectedDeviceId={selectedVehicle?.device.id ?? null}
            onSelectDevice={(device, position) => {
              setSelectedVehicle({ device, position });
              setHasAutoOpenedMap(true);
            }}
          />
        </nav>

        <div className="border-t border-sidebar-border space-y-1 p-2">
          {bottomNavItems.map((item) => {
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
        </div>

        {!sidebarCollapsed && userIsAdmin && (
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

      {!sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(true)}
          title="Recolher menu"
          style={{ left: 'calc(400px + 0.5rem)', top: '1rem' }}
          className="fixed z-[1001] hidden lg:flex items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground shadow-2xl hover:bg-accent hover:text-accent-foreground hover:scale-110 active:scale-95 transition-all duration-200 h-8 w-8"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!showVehicleMap && (
          <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-semibold text-card-foreground lg:hidden">
                {[...headerNavItems, ...navItems, ...bottomNavItems].find((i) => i.path === location.pathname)?.label || 'Sistema de Cobrança'}
              </h2>
              <nav className="hidden md:flex items-center gap-1 ml-4">
                {headerNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSelectedVehicle(null)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
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
        )}

        {showVehicleMap ? (
          <div className="flex-1 min-h-0">
            <VehicleMapView
              device={selectedVehicle!.device}
              position={selectedVehicle?.position}
              onClose={() => setSelectedVehicle(null)}
            />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        )}
      </div>
      <TraccarUsersDialog open={showTraccarUsers} onOpenChange={setShowTraccarUsers} />
    </div>
  );
};

export default AppLayout;
