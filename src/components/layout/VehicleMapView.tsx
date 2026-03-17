import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Calendar, Battery, Satellite, Gauge, Power, ChevronDown, ChevronUp, Car, Lock, Unlock, Anchor, Route, Map as MapIcon, Pencil, History, Loader2, Layers, X, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TraccarDevice, TraccarPosition } from './SidebarVehicles';
import { userStorageGet } from '@/services/auth';
import api from '@/services/api';
import { toast } from 'sonner';
import { getVehicleStopTime } from '@/hooks/useVehicleStopTime';

interface VehicleMapViewProps {
  device: TraccarDevice;
  position?: TraccarPosition;
  onClose: () => void;
}

const VehicleMapView = ({ device: initialDevice, position: initialPosition, onClose }: VehicleMapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const [blockedMap, setBlockedMap] = useState<Record<number, boolean>>({});
  const [blocking, setBlocking] = useState(false);
  const [mapType, setMapType] = useState<'satellite' | 'roadmap'>('satellite');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const anchorCircleRef = useRef<L.Circle | null>(null);
  const [anchorMap, setAnchorMap] = useState<Record<number, boolean>>({});
  const [livePosition, setLivePosition] = useState<TraccarPosition | undefined>(initialPosition);
  const [liveDevice, setLiveDevice] = useState<TraccarDevice>(initialDevice);

  // Sync when parent selects a different vehicle (instant UI + instant map focus)
  useEffect(() => {
    setLiveDevice(initialDevice);
    setLivePosition(initialPosition);
    setCardOpen(true);
    setCardCollapsed(false);

    if (anchorCircleRef.current) {
      anchorCircleRef.current.remove();
      anchorCircleRef.current = null;
    }

    if (initialPosition && mapInstanceRef.current) {
      const nextLatLng: L.LatLngExpression = [initialPosition.latitude, initialPosition.longitude];
      mapInstanceRef.current.flyTo(nextLatLng, 18, { duration: 0.35 });
      if (markerRef.current) {
        markerRef.current.setLatLng(nextLatLng);
      }
    }
  }, [initialDevice.id, initialPosition]);

  // Poll for live position & device updates
  useEffect(() => {
    const fetchLive = async () => {
      const traccar_url = userStorageGet('traccar_url');
      const traccar_user = userStorageGet('traccar_user');
      const traccar_password = userStorageGet('traccar_password');
      if (!traccar_url || !traccar_user || !traccar_password) return;

      try {
        const [posRes, devRes] = await Promise.all([
          api.traccarProxy({ traccar_url, traccar_user, traccar_password, endpoint: '/api/positions', method: 'GET' }),
          api.traccarProxy({ traccar_url, traccar_user, traccar_password, endpoint: `/api/devices?id=${initialDevice.id}`, method: 'GET' }),
        ]);

        if (posRes.success) {
          const posData = posRes.data?.data || posRes.data;
          const positions = Array.isArray(posData) ? posData as TraccarPosition[] : [];
          const myPos = positions.find((p) => p.deviceId === initialDevice.id);
          if (myPos) {
            setLivePosition(myPos);
            if (markerRef.current) markerRef.current.setLatLng([myPos.latitude, myPos.longitude]);
          }
        }

        if (devRes.success) {
          const devData = devRes.data?.data || devRes.data;
          const devArr = Array.isArray(devData) ? devData as TraccarDevice[] : [];
          if (devArr.length > 0) setLiveDevice(devArr[0]);
        }
      } catch { /* silent */ }
    };

    void fetchLive();
    const interval = setInterval(fetchLive, 3000);
    return () => clearInterval(interval);
  }, [initialDevice.id]);

  const sendCommand = useCallback(async (type: 'engineStop' | 'engineResume') => {
    const traccar_url = userStorageGet('traccar_url');
    const traccar_user = userStorageGet('traccar_user');
    const traccar_password = userStorageGet('traccar_password');

    if (!traccar_url || !traccar_user || !traccar_password) {
      toast.error('Credenciais do Traccar não configuradas');
      return false;
    }

    setBlocking(true);
    try {
      const result = await api.traccarProxy({
        traccar_url,
        traccar_user,
        traccar_password,
        endpoint: '/api/commands/send',
        method: 'POST',
        body: {
          deviceId: liveDevice.id,
          type,
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar comando');
      }

      return true;
    } catch (err: any) {
      toast.error(`Falha: ${err?.message || 'erro desconhecido'}`);
      return false;
    } finally {
      setBlocking(false);
    }
  }, [liveDevice.id]);

  const blocked = blockedMap[liveDevice.id] ?? false;
  const anchorActive = anchorMap[liveDevice.id] ?? false;

  const handleToggleBlock = useCallback(async () => {
    const devId = liveDevice.id;
    if (blockedMap[devId]) {
      const ok = await sendCommand('engineResume');
      if (ok) {
        setBlockedMap((m) => ({ ...m, [devId]: false }));
        toast.success(`${liveDevice.name} desbloqueado!`);
      }
    } else {
      const ok = await sendCommand('engineStop');
      if (ok) {
        setBlockedMap((m) => ({ ...m, [devId]: true }));
        toast.success(`${liveDevice.name} bloqueado!`);
      }
    }
  }, [blockedMap, liveDevice.id, liveDevice.name, sendCommand]);

  const initPosRef = useRef(initialPosition);
  initPosRef.current = initialPosition;

  useEffect(() => {
    const pos = initPosRef.current;
    if (!mapRef.current || !pos) return;

    const timeout = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: false }).setView([pos.latitude, pos.longitude], 18);
      L.control.zoom({ position: 'topright' }).addTo(map);

      const tileUrl = mapType === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: '© Google Maps',
        maxZoom: 20,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      const icon = L.divIcon({
        html: `<div style="background:hsl(var(--primary));color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:3px solid white;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([pos.latitude, pos.longitude], { icon }).addTo(map);
      markerRef.current = marker;

      marker.on('click', () => {
        setCardOpen(true);
        setCardCollapsed(false);
        if (markerRef.current) {
          const ll = markerRef.current.getLatLng();
          map.flyTo(ll, 18, { duration: 0.5 });
        }
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }, 50);

    return () => {
      clearTimeout(timeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initialDevice.id, mapType]);

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return dateStr; }
  };

  const attrs = livePosition?.attributes || {};
  const ignition = attrs.ignition;
  const power = attrs.power;
  const sat = attrs.sat;
  const motion = attrs.motion;
  const speed = livePosition?.speed ?? 0;

  const getStatusLabel = () => {
    if (liveDevice.status === 'offline') return 'Offline';
    if (speed > 1) return `${Math.round(speed)} km/h`;
    if (motion) return 'Em movimento';
    return 'Parado';
  };

  const getStatusBg = () => {
    if (liveDevice.status === 'offline') return 'bg-red-500/20 text-red-400';
    if (speed > 1) return 'bg-blue-500/20 text-blue-400';
    return 'bg-emerald-500/20 text-emerald-400';
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Map type selector */}
      <button
        onClick={() => setMapType(mapType === 'satellite' ? 'roadmap' : 'satellite')}
        className="absolute top-3 right-14 z-[1000] rounded-lg px-3 py-2 bg-slate-900/80 backdrop-blur-sm shadow-lg hover:bg-slate-900 text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
        title={mapType === 'satellite' ? 'Mapa normal' : 'Satélite'}
      >
        <Layers className="h-4 w-4" />
        {mapType === 'satellite' ? 'Mapa' : 'Satélite'}
      </button>


      {/* Vehicle info card */}
      {cardOpen && livePosition && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] w-80 max-w-[calc(100%-2rem)]">
          <div className="rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl overflow-hidden border border-white/10">
            {/* Collapse toggle */}
            <button
              onClick={() => setCardCollapsed(!cardCollapsed)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-white/60">
                {cardCollapsed ? 'Expandir' : 'Recolher'}
              </span>
              {cardCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-white/60" /> : <ChevronUp className="h-3.5 w-3.5 text-white/60" />}
              <button
                onClick={(e) => { e.stopPropagation(); setCardOpen(false); }}
                className="absolute right-2 top-1.5 p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </button>

            {!cardCollapsed && (
              <div className="px-4 pb-3 space-y-3">
                {/* Vehicle name and speed */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold">{Math.round(speed)}</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/50">KM/H</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{liveDevice.name}</h3>
                    <p className="text-[11px] text-white/50 truncate mt-0.5">ID: {liveDevice.uniqueId}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                        liveDevice.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", liveDevice.status === 'online' ? 'bg-emerald-400' : 'bg-red-400')} />
                        {liveDevice.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                      {ignition !== undefined && (
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                          ignition ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                        )}>
                          <Power className="h-2.5 w-2.5" />
                          {ignition ? 'Ligado' : 'Desligado'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address */}
                {livePosition.address && (
                  <div className="flex items-start gap-2 text-[11px] text-white/70">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-white/40" />
                    <span className="leading-relaxed">{livePosition.address}</span>
                  </div>
                )}

                {/* Info pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                    <Calendar className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] font-medium">{formatDateTime(livePosition.fixTime)}</span>
                  </div>
                  {power !== undefined && (
                    <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                      <Battery className="h-3 w-3 text-yellow-400" />
                      <span className="text-[10px] font-medium">{(power).toFixed(1)}V</span>
                    </div>
                  )}
                  {sat !== undefined && (
                    <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                      <Satellite className="h-3 w-3 text-cyan-400" />
                      <span className="text-[10px] font-medium">{sat}</span>
                    </div>
                  )}
                  <div className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5", getStatusBg())}>
                    <Gauge className="h-3 w-3" />
                    <span className="text-[10px] font-bold">{getStatusLabel()}</span>
                  </div>
                  {(() => {
                    const { formattedDuration } = getVehicleStopTime({ position: livePosition ?? null });
                    return formattedDuration ? (
                      <div className="flex items-center gap-1.5 bg-yellow-500/20 rounded-lg px-2.5 py-1.5">
                        <Timer className="h-3 w-3 text-yellow-400" />
                        <span className="text-[10px] font-bold text-yellow-400">Parado {formattedDuration}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {/* Action buttons - always visible */}
            <div className="flex items-center gap-1.5 px-4 pb-3">
              <button
                onClick={handleToggleBlock}
                disabled={blocking}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors",
                  blocked
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white",
                  blocking && "opacity-70 cursor-not-allowed"
                )}
              >
                {blocking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : blocked ? (
                  <Unlock className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {blocking ? 'ENVIANDO...' : blocked ? 'DESBLOQUEAR' : 'BLOQUEAR'}
              </button>
              <button
                title="Âncora"
                onClick={() => {
                  const devId = liveDevice.id;
                  const next = !anchorMap[devId];
                  setAnchorMap((m) => ({ ...m, [devId]: next }));
                  if (next && livePosition && mapInstanceRef.current) {
                    if (anchorCircleRef.current) anchorCircleRef.current.remove();
                    anchorCircleRef.current = L.circle([livePosition.latitude, livePosition.longitude], {
                      radius: 50,
                      color: '#ef4444',
                      fillColor: '#ef4444',
                      fillOpacity: 0.15,
                      weight: 2,
                    }).addTo(mapInstanceRef.current);
                  } else {
                    if (anchorCircleRef.current) {
                      anchorCircleRef.current.remove();
                      anchorCircleRef.current = null;
                    }
                  }
                }}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                  anchorActive
                    ? "bg-blue-500 text-white animate-pulse"
                    : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                )}
              >
                <Anchor className="h-4 w-4" />
              </button>
              <button title="Rota" className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                <Route className="h-4 w-4" />
              </button>
              <button title="Street View" className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                <MapIcon className="h-4 w-4" />
              </button>
              <button title="Histórico" className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                <History className="h-4 w-4" />
              </button>
              <button title="Editar" className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      {livePosition ? (
        <div ref={mapRef} className="flex-1 min-h-0" />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Sem dados de posição disponíveis</p>
        </div>
      )}
    </div>
  );
};

export default VehicleMapView;
