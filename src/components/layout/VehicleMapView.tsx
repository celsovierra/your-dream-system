import { useEffect, useRef } from 'react';
import { Car, Navigation, Clock, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  category?: string;
}

interface TraccarPosition {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address?: string;
  fixTime: string;
}

interface VehicleMapViewProps {
  device: TraccarDevice;
  position?: TraccarPosition;
  onClose: () => void;
}

const VehicleMapView = ({ device, position, onClose }: VehicleMapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

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
        html: `<div style="background:hsl(var(--primary));color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
        </div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([position.latitude, position.longitude], { icon })
        .addTo(map)
        .bindPopup(`<strong>${device.name}</strong><br/>${position.address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`}`)
        .openPopup();

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

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  return (
    <div className="relative flex flex-col h-full">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-[1000] rounded-full p-2 bg-card/90 backdrop-blur-sm shadow-md hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

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
