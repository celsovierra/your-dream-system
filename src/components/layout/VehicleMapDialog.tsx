import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Car, Navigation, Clock } from 'lucide-react';
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

interface VehicleMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: TraccarDevice;
  position?: TraccarPosition;
}

const VehicleMapDialog = ({ open, onOpenChange, device, position }: VehicleMapDialogProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!open || !mapRef.current || !position) return;

    // Small delay to let dialog render
    const timeout = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapRef.current) return;

      const mobile = window.innerWidth < 768;
      const map = L.map(mapRef.current, { preferCanvas: true, fadeAnimation: !mobile, zoomAnimation: !mobile }).setView([position.latitude, position.longitude], mobile ? 14 : 15);

      L.tileLayer(mobile ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}' : 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: mobile ? 18 : 20,
        updateWhenZooming: false,
        updateWhenIdle: true,
      }).addTo(map);

      const course = position.course ?? 0;
      const isMoto = device.category?.toLowerCase() === 'motorcycle';
      const iconImg = isMoto ? '/images/moto-top-view.png' : '/images/car-top-view.png';
      const iconW = mobile ? (isMoto ? 32 : 38) : (isMoto ? 45 : 54);
      const iconH = mobile ? (isMoto ? 50 : 64) : (isMoto ? 70 : 90);
      const icon = L.divIcon({
        html: `<div style="width:${iconW}px;height:${iconH}px;display:flex;align-items:center;justify-content:center;transform:rotate(${course}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
          <img src="${iconImg}" style="width:${iconW - 4}px;height:${iconH - 4}px;object-fit:contain;" />
        </div>`,
        className: '',
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, iconH / 2],
      });

      L.marker([position.latitude, position.longitude], { icon })
        .addTo(map)
        .bindPopup(`<strong>${device.name}</strong><br/>${position.address || `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`}`)
        .openPopup();

      mapInstanceRef.current = map;

      // Fix tile loading issues
      setTimeout(() => map.invalidateSize(), 200);
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [open, position, device.name]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            {device.name}
            <span className={`ml-2 inline-flex h-2.5 w-2.5 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
          </DialogTitle>
        </DialogHeader>

        {position ? (
          <>
            <div className="flex items-center gap-4 px-6 pb-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Navigation className="h-3.5 w-3.5" />
                {Math.round(position.speed)} km/h
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(position.fixTime)}
              </span>
              {position.address && (
                <span className="truncate flex-1">{position.address}</span>
              )}
            </div>
            <div ref={mapRef} className="flex-1 min-h-0" />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Sem dados de posição disponíveis</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VehicleMapDialog;
