import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Approximate coordinates for Tlemcen communes
const COMMUNE_COORDS: Record<string, [number, number]> = {
  'Tlemcen': [34.8828, -1.3167],
  'Mansourah': [34.8600, -1.3300],
  'Chetouane': [34.9100, -1.2900],
  'Remchi': [35.0600, -1.4300],
  'Ghazaouet': [35.1000, -1.8600],
  'Maghnia': [34.8500, -1.7400],
  'Sebdou': [34.6300, -1.3300],
  'Hennaya': [34.9500, -1.3700],
  'Nedroma': [35.0700, -1.7500],
  'Beni Snous': [34.6600, -1.5500],
  'Ouled Mimoun': [34.9000, -1.0300],
  'Ain Tallout': [34.8500, -1.2000],
  'Bab El Assa': [35.0800, -2.0200],
  'Honaine': [35.1800, -1.6600],
};

interface CasePoint {
  commune: string | null;
  count: number;
}

interface TlemcenMapProps {
  casesByCommune: CasePoint[];
}

export default function TlemcenMap({ casesByCommune }: TlemcenMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [34.88, -1.32],
      zoom: 9,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 16,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Add case markers with random offset for anonymization
    casesByCommune.forEach(({ commune, count }) => {
      if (!commune || !COMMUNE_COORDS[commune]) return;
      const [lat, lng] = COMMUNE_COORDS[commune];

      // Add slight random offset for anonymization
      const offset = () => (Math.random() - 0.5) * 0.03;

      for (let i = 0; i < Math.min(count, 20); i++) {
        L.circleMarker([lat + offset(), lng + offset()], {
          radius: 5,
          fillColor: 'hsl(213, 80%, 45%)',
          color: 'hsl(213, 80%, 35%)',
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.6,
        })
          .bindPopup(`<strong>${commune}</strong><br/>${count} cas`)
          .addTo(map);
      }
    });
  }, [casesByCommune]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '280px' }}
    />
  );
}
