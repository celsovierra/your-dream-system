import { useState, useEffect, useCallback, useMemo } from 'react';
import { Car, Loader2, WifiOff, RefreshCw, Search, Share2, Pencil, Wifi, Clock, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { userStorageGet } from '@/services/auth';
import api from '@/services/api';
import { getVehicleStopTime } from '@/hooks/useVehicleStopTime';

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  category?: string;
  model?: string;
}

export interface TraccarPosition {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address?: string;
  fixTime: string;
  deviceTime?: string;
  serverTime?: string;
  attributes?: {
    batteryLevel?: number;
    ignition?: boolean;
    totalDistance?: number;
    motion?: boolean;
    sat?: number;
    power?: number;
    [key: string]: any;
  };
}

interface SidebarVehiclesProps {
  collapsed: boolean;
  onSelectDevice?: (device: TraccarDevice, position?: TraccarPosition) => void;
  selectedDeviceId?: number | null;
  autoSelectFirst?: boolean;
}


function formatDateTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function getCategoryIcon(category?: string) {
  switch (category?.toLowerCase()) {
    case 'motorcycle':
      return '🏍️';
    case 'truck':
      return '🚛';
    case 'bus':
      return '🚌';
    case 'bicycle':
      return '🚲';
    case 'boat':
      return '🚤';
    default:
      return '🚗';
  }
}

const SidebarVehicles = ({ collapsed, onSelectDevice, selectedDeviceId, autoSelectFirst = false }: SidebarVehiclesProps) => {
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const getCredentials = useCallback(() => {
    const traccar_url = userStorageGet('traccar_url');
    const traccar_user = userStorageGet('traccar_user');
    const traccar_password = userStorageGet('traccar_password');
    return { traccar_url, traccar_user, traccar_password };
  }, []);

  const unwrapProxyPayload = (payload: unknown) => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
      const nested = (payload as { data: unknown }).data;
      if (nested && typeof nested === 'object' && 'data' in nested) {
        return (nested as { data: unknown }).data;
      }
      return nested;
    }
    return payload;
  };

  const fetchDevices = useCallback(async () => {
    const creds = getCredentials();
    if (!creds.traccar_url || !creds.traccar_user || !creds.traccar_password) {
      setConfigured(false);
      setError(null);
      setDevices([]);
      setPositions([]);
      return;
    }

    setConfigured(true);
    setLoading(true);
    setError(null);

    try {
      const devResult = await api.traccarProxy({ ...creds, endpoint: '/api/devices', method: 'GET' });
      const devData = unwrapProxyPayload(devResult.data);
      if (!devResult.success || !Array.isArray(devData)) {
        throw new Error(devResult.error || 'Não foi possível carregar os veículos do Traccar');
      }

      const nextDevices = devData as TraccarDevice[];
      setDevices(nextDevices);

      const posResult = await api.traccarProxy({ ...creds, endpoint: '/api/positions', method: 'GET' });
      const posData = unwrapProxyPayload(posResult.data);
      if (!posResult.success) {
        throw new Error(posResult.error || 'Não foi possível carregar as posições do Traccar');
      }
      const nextPositions = Array.isArray(posData) ? (posData as TraccarPosition[]) : [];
      setPositions(nextPositions);


    } catch (err: any) {
      const message = err?.message || 'Erro ao carregar veículos do Traccar';
      setDevices([]);
      setPositions([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  useEffect(() => {
    void fetchDevices();
    const interval = setInterval(() => void fetchDevices(), 60000);
    const handleRefresh = () => void fetchDevices();
    window.addEventListener('traccar-config-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('traccar-config-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [fetchDevices]);

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const getDevicePosition = (deviceId: number) => positions.find((p) => p.deviceId === deviceId);

  const filteredDevices = useMemo(() => {
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter((d) => d.name.toLowerCase().includes(q));
  }, [devices, search]);

  const handleClick = (device: TraccarDevice) => {
    onSelectDevice?.(device, getDevicePosition(device.id));
  };

  useEffect(() => {
    if (!autoSelectFirst || loading || !onSelectDevice || selectedDeviceId || devices.length === 0) return;
    const first = devices[0];
    onSelectDevice(first, getDevicePosition(first.id));
  }, [autoSelectFirst, loading, onSelectDevice, selectedDeviceId, devices, positions]);

  if (!configured) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/50">
            <WifiOff className="mx-auto mb-1 h-4 w-4" />
            Traccar não configurado
          </p>
        )}
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 p-1">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-sidebar-foreground/50" />
        ) : (
          devices.slice(0, 10).map((device) => {
            const isOnline = device.status === 'online';
            return (
              <button
                key={device.id}
                onClick={() => handleClick(device)}
                title={`${device.name} (${device.status})`}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent',
                  selectedDeviceId === device.id && 'bg-sidebar-primary text-sidebar-primary-foreground'
                )}
              >
                <Car className="h-4 w-4 text-sidebar-foreground/70" />
                <span className={cn('absolute right-0.5 top-0.5 h-2 w-2 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-destructive')} />
              </button>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Veículos ({filteredDevices.length})
        </span>
        <button
          onClick={() => void fetchDevices()}
          disabled={loading}
          className="rounded p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar veículo..."
            className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 py-1.5 pl-8 pr-3 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
          />
        </div>
      </div>

      {loading && devices.length === 0 ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin text-sidebar-foreground/50" />
        </div>
      ) : error && devices.length === 0 ? (
        <div className="space-y-2 p-4 text-center">
          <p className="text-xs text-destructive">{error}</p>
          <button
            onClick={() => void fetchDevices()}
            className="w-full rounded-md border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            Tentar novamente
          </button>
        </div>
      ) : filteredDevices.length === 0 ? (
        <p className="p-4 text-center text-xs text-sidebar-foreground/50">
          {devices.length === 0 ? 'Nenhum veículo encontrado' : 'Nenhum resultado'}
        </p>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
          {filteredDevices.map((device) => {
            const pos = getDevicePosition(device.id);
            const isSelected = selectedDeviceId === device.id;
            const isOnline = device.status === 'online';
            const ignition = pos?.attributes?.ignition;
            const speed = pos?.speed ?? 0;
            const sat = pos?.attributes?.sat;
            const power = pos?.attributes?.power;
            const isMoving = speed > 0;

            const { formattedDuration } = getVehicleStopTime({
              position: pos ? { ...pos, deviceId: device.id } : null,
            });

            return (
              <div
                key={device.id}
                onClick={() => handleClick(device)}
                className={cn(
                  'cursor-pointer rounded-xl border p-3 transition-all duration-200',
                  isSelected
                    ? 'border-emerald-500/50 bg-[hsl(180,15%,12%)] shadow-[0_0_12px_-3px_rgba(16,185,129,0.3)]'
                    : 'border-[hsl(180,10%,18%)] bg-[hsl(180,10%,10%)] hover:border-emerald-500/30 hover:bg-[hsl(180,10%,13%)]'
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-2xl leading-none">{getCategoryIcon(device.category)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-tight text-white">{device.name}</p>
                    {device.model && <p className="truncate text-xs leading-tight text-[hsl(180,5%,55%)]">{device.model}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={(e) => e.stopPropagation()} title="Compartilhar" className="rounded-md p-1.5 text-[hsl(180,5%,45%)] transition-colors hover:bg-white/10 hover:text-white">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => e.stopPropagation()} title="Editar" className="rounded-md p-1.5 text-[hsl(180,5%,45%)] transition-colors hover:bg-white/10 hover:text-white">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold', isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className={cn('flex items-center gap-1 font-bold', ignition ? 'text-green-400' : 'text-yellow-400')}>
                    <KeyRound className="h-3.5 w-3.5" />{ignition ? 'Lig' : 'Des'}
                  </span>
                  <span className="text-white/70 font-medium"><Wifi className="mr-1 inline h-3.5 w-3.5" />OK</span>
                  <span className="text-white/70 font-medium">⏱ {Math.round(speed)} km/h</span>
                  {sat !== undefined && <span className="text-white/70 font-medium">📡 {sat}</span>}
                  {power !== undefined && <span className="text-white/70 font-medium">🔋 {power.toFixed(1)}V</span>}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  {isMoving ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <Clock className="h-3.5 w-3.5" /> Em movimento
                    </span>
                  ) : formattedDuration ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-400">
                      <Clock className="h-3.5 w-3.5" /> Parado {formattedDuration}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-400">
                      <Clock className="h-3.5 w-3.5" /> Parado
                    </span>
                  )}
                  <span className="text-xs text-[hsl(180,5%,45%)]">{formatDateTime(device.lastUpdate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SidebarVehicles;
