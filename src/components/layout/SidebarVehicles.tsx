import { useState, useEffect, useCallback } from 'react';
import { Car, MapPin, Loader2, WifiOff, RefreshCw } from 'lucide-react';
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
}

export interface TraccarPosition {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address?: string;
  fixTime: string;
}

interface SidebarVehiclesProps {
  collapsed: boolean;
  onSelectDevice?: (device: TraccarDevice, position?: TraccarPosition) => void;
  selectedDeviceId?: number | null;
}

const SidebarVehicles = ({ collapsed, onSelectDevice, selectedDeviceId }: SidebarVehiclesProps) => {
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);

  const getCredentials = useCallback(() => {
    const traccar_url = userStorageGet('traccar_url');
    const traccar_user = userStorageGet('traccar_user');
    const traccar_password = userStorageGet('traccar_password');
    return { traccar_url, traccar_user, traccar_password };
  }, []);

  const fetchDevices = useCallback(async () => {
    const creds = getCredentials();
    if (!creds.traccar_url || !creds.traccar_user || !creds.traccar_password) {
      setConfigured(false);
      return;
    }
    setConfigured(true);
    setLoading(true);

    try {
      const devResult = await api.traccarProxy({ ...creds, endpoint: '/api/devices', method: 'GET' });
      if (!devResult.success || !Array.isArray(devResult.data?.data)) throw new Error('Erro');
      setDevices(devResult.data.data);

      const posResult = await api.traccarProxy({ ...creds, endpoint: '/api/positions', method: 'GET' });
      if (posResult.success && Array.isArray(posResult.data?.data)) {
        setPositions(posResult.data.data);
      }
    } catch (err: any) {
      console.error('Traccar devices error:', err);
    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const getDevicePosition = (deviceId: number) => positions.find((p) => p.deviceId === deviceId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const handleClick = (device: TraccarDevice) => {
    onSelectDevice?.(device, getDevicePosition(device.id));
  };

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
          devices.slice(0, 10).map((device) => (
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
              <span className={cn("absolute top-0.5 right-0.5 h-2 w-2 rounded-full", getStatusColor(device.status))} />
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
          Veículos ({devices.length})
        </span>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className="rounded p-1 hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {loading && devices.length === 0 ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-5 w-5 animate-spin text-sidebar-foreground/50" />
        </div>
      ) : devices.length === 0 ? (
        <p className="text-xs text-sidebar-foreground/50 text-center p-4">Nenhum veículo encontrado</p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-0.5 px-2">
          {devices.map((device) => {
            const pos = getDevicePosition(device.id);
            const isSelected = selectedDeviceId === device.id;
            return (
              <button
                key={device.id}
                onClick={() => handleClick(device)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors group",
                  isSelected
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent"
                )}
              >
                <div className="relative shrink-0">
                  <Car className={cn("h-4 w-4", isSelected ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground")} />
                  <span className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-sidebar", getStatusColor(device.status))} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("truncate font-medium text-xs", isSelected ? "text-sidebar-primary-foreground" : "text-sidebar-foreground")}>{device.name}</p>
                  {pos && pos.speed > 0 ? (
                    <p className={cn("text-[10px] truncate", isSelected ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/50")}>
                      {Math.round(pos.speed)} km/h
                    </p>
                  ) : (
                    <p className={cn("text-[10px]", isSelected ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/50")}>
                      {device.status === 'online' ? 'Parado' : 'Offline'}
                    </p>
                  )}
                </div>
                <MapPin className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60")} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SidebarVehicles;
