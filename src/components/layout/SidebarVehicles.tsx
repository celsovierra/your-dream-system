import { useState, useEffect, useCallback, useMemo } from 'react';
import { Car, Loader2, WifiOff, RefreshCw, Search, Share2, Pencil, ShieldOff, Wifi, Gauge, Radio, Battery, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { userStorageGet } from '@/services/auth';
import api from '@/services/api';

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

function formatStoppedTime(lastUpdate: string): string {
  if (!lastUpdate) return '';
  const diff = Date.now() - new Date(lastUpdate).getTime();
  if (diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return `${hours}h ${remMins}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ', ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getCategoryIcon(category?: string): string {
  switch (category?.toLowerCase()) {
    case 'motorcycle': return '🏍️';
    case 'car': return '🚗';
    case 'truck': return '🚛';
    case 'bus': return '🚌';
    case 'bicycle': return '🚲';
    case 'boat': return '🚤';
    default: return '🚗';
  }
}

const SidebarVehicles = ({ collapsed, onSelectDevice, selectedDeviceId, autoSelectFirst = false }: SidebarVehiclesProps) => {
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      setDevices(devData as TraccarDevice[]);

      const posResult = await api.traccarProxy({ ...creds, endpoint: '/api/positions', method: 'GET' });
      const posData = unwrapProxyPayload(posResult.data);
      if (!posResult.success) {
        throw new Error(posResult.error || 'Não foi possível carregar as posições do Traccar');
      }
      setPositions(Array.isArray(posData) ? (posData as TraccarPosition[]) : []);
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
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    const handleRefresh = () => { void fetchDevices(); };
    window.addEventListener('traccar-config-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('traccar-config-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
  }, [fetchDevices]);

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
            <WifiOff className="h-4 w-4 mx-auto mb-1" />
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
                  "relative flex items-center justify-center rounded-md h-8 w-8 hover:bg-sidebar-accent transition-colors",
                  selectedDeviceId === device.id && "bg-sidebar-primary text-sidebar-primary-foreground"
                )}
              >
                <Car className="h-4 w-4 text-sidebar-foreground/70" />
                <span className={cn("absolute top-0.5 right-0.5 h-2 w-2 rounded-full", isOnline ? 'bg-emerald-500' : 'bg-destructive')} />
              </button>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Veículos ({filteredDevices.length})
        </span>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className="rounded p-1 hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar veículo..."
            className="w-full rounded-lg bg-sidebar-accent/50 border border-sidebar-border pl-8 pr-3 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
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
            onClick={() => fetchDevices()}
            className="w-full rounded-md border border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            Tentar novamente
          </button>
        </div>
      ) : filteredDevices.length === 0 ? (
        <p className="text-xs text-sidebar-foreground/50 text-center p-4">
          {devices.length === 0 ? 'Nenhum veículo encontrado' : 'Nenhum resultado'}
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 px-2 pb-2">
          {filteredDevices.map((device) => {
            const pos = getDevicePosition(device.id);
            const isSelected = selectedDeviceId === device.id;
            const isOnline = device.status === 'online';
            const ignition = pos?.attributes?.ignition;
            const speed = pos?.speed ?? 0;
            const sat = pos?.attributes?.sat;
            const power = pos?.attributes?.power;
            const isMoving = pos?.attributes?.motion || speed > 1;
            const stoppedTime = !isMoving ? formatStoppedTime(pos?.fixTime || device.lastUpdate) : '';

            return (
              <div
                key={device.id}
                onClick={() => handleClick(device)}
                className={cn(
                  "rounded-xl border p-3 cursor-pointer transition-all duration-200",
                  isSelected
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.3)]"
                    : "border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent/60 hover:border-sidebar-foreground/20"
                )}
              >
                {/* Row 1: Name + Status + Actions */}
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none shrink-0">{getCategoryIcon(device.category)}</span>
                  <span className={cn("font-bold text-[11px] truncate flex-1 min-w-0", isSelected ? "text-primary" : "text-sidebar-foreground")}>
                    {device.name}
                  </span>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide",
                    isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-destructive/20 text-destructive"
                  )}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  <div className="flex items-center shrink-0 -mr-1">
                    <button onClick={e => e.stopPropagation()} title="Compartilhar" className="rounded p-1 text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                      <Share2 className="h-3 w-3" />
                    </button>
                    <button onClick={e => e.stopPropagation()} title="Editar" className="rounded p-1 text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={e => e.stopPropagation()} title="Bloquear" className="rounded p-1 text-sidebar-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <ShieldOff className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {device.model && (
                  <p className="text-[10px] text-sidebar-foreground/40 truncate ml-7 -mt-0.5">{device.model}</p>
                )}

                {/* Row 2: Telemetry - compact single line */}
                <div className="flex items-center gap-2 mt-1.5 ml-7 text-[10px] text-sidebar-foreground/50">
                  <span className={cn("font-semibold", ignition ? "text-emerald-400" : "text-destructive/70")}>
                    ⚡{ignition ? 'Lig' : 'Des'}
                  </span>
                  <span>📶OK</span>
                  <span>⏱{Math.round(speed)}km/h</span>
                  {sat !== undefined && <span>📡{sat}</span>}
                </div>

                {/* Row 3: Voltage on its own if present */}
                {power !== undefined && (
                  <div className="ml-7 mt-0.5 text-[10px] text-sidebar-foreground/50">
                    🔋 {power.toFixed(1)}V
                  </div>
                )}

                {/* Row 4: Status + time */}
                <div className="flex items-center justify-between mt-1.5 ml-7">
                  {stoppedTime ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive">
                      <Clock className="h-3 w-3" /> Parado {stoppedTime}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <Clock className="h-3 w-3" /> Em movimento
                    </span>
                  )}
                  <span className="text-[9px] text-sidebar-foreground/35">
                    {formatDateTime(pos?.fixTime || device.lastUpdate)}
                  </span>
                </div>
              </div>
  );
};

export default SidebarVehicles;