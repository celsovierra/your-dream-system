import { useEffect, useRef, useState } from 'react';
import { X, MapPin, Calendar, Battery, Satellite, Gauge, Power, ChevronDown, ChevronUp, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TraccarDevice, TraccarPosition } from './SidebarVehicles';

interface VehicleMapViewProps {
  device: TraccarDevice;
  position?: TraccarPosition;
  onClose: () => void;
}

const VehicleMapView = ({ device, position, onClose }: VehicleMapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [cardCollapsed, setCardCollapsed] = useState(false);

  useEffect(() => {
    if (!mapRef.current || !position) return;

    const timeout = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapRef.current) return;

      const map = L.map(mapRef.current).setView([position.latitude, position.longitude], 15);

      L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="background:hsl(var(--primary));color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:3px solid white;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([position.latitude, position.longitude], { icon }).addTo(map);

      marker.on('click', () => {
        setCardOpen(true);
        setCardCollapsed(false);
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
  }, [position, device.name]);

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return dateStr; }
  };

  const attrs = position?.attributes || {};
  const ignition = attrs.ignition;
  const power = attrs.power;
  const sat = attrs.sat;
  const motion = attrs.motion;
  const speed = position?.speed ?? 0;

  const getStatusLabel = () => {
    if (device.status === 'offline') return 'Offline';
    if (speed > 1) return `${Math.round(speed)} km/h`;
    if (motion) return 'Em movimento';
    return 'Parado';
  };

  const getStatusBg = () => {
    if (device.status === 'offline') return 'bg-red-500/20 text-red-400';
    if (speed > 1) return 'bg-blue-500/20 text-blue-400';
    return 'bg-emerald-500/20 text-emerald-400';
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-[1000] rounded-full p-2 bg-slate-900/80 backdrop-blur-sm shadow-lg hover:bg-slate-900 text-white transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Vehicle info card */}
      {cardOpen && position && (
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
              <div className="px-4 pb-4 space-y-3">
                {/* Vehicle name and speed */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold">{Math.round(speed)}</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/50">KM/H</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{device.name}</h3>
                    <p className="text-[11px] text-white/50 truncate mt-0.5">ID: {device.uniqueId}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                        device.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", device.status === 'online' ? 'bg-emerald-400' : 'bg-red-400')} />
                        {device.status === 'online' ? 'Online' : 'Offline'}
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
                {position.address && (
                  <div className="flex items-start gap-2 text-[11px] text-white/70">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-white/40" />
                    <span className="leading-relaxed">{position.address}</span>
                  </div>
                )}

                {/* Info pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                    <Calendar className="h-3 w-3 text-blue-400" />
                    <span className="text-[10px] font-medium">{formatDateTime(position.fixTime)}</span>
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
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map */}
      {position ? (
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
