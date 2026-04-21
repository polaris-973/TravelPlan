import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import type { PlaceVisit, Hotel, Location } from '../../types/trip';

interface LeafletMapViewProps {
  places: PlaceVisit[];
  hotels?: Hotel[];
  onMarkerClick?: (place: PlaceVisit) => void;
  selectedPlaceId?: string | null;
  mapLayer?: 'standard' | 'satellite';
  /** Optional per-place badge text (e.g. "D1-3"). If absent, falls back to index+1. */
  placeLabels?: Record<string, string>;
  /** If provided, draw per-day dashed path in separate colour groups. Each entry: day's ordered place IDs. */
  dayGroups?: Array<{ dayIndex: number; placeIds: string[] }>;
}

const CATEGORY_EMOJI: Record<string, string> = {
  nature: '🏔️', heritage: '🏯', food: '🍜',
  hotel: '🏨', transport: '🚆', shopping: '🛍️', activity: '🎯',
};
const CATEGORY_COLOR: Record<string, string> = {
  nature: '#8BA888', heritage: '#D4A574', food: '#C85A3E',
  hotel: '#6B7FA8', transport: '#A1A1A6', shopping: '#D4A574', activity: '#3A7A8C',
};

function haversineKm(a: Location, b: Location): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

// Per-day colours (cycles) for multi-day overview lines
const DAY_COLORS = ['#3A7A8C', '#C85A3E', '#8BA888', '#D4A574', '#6B7FA8', '#9E7EB8', '#D77A7A'];

export function LeafletMapView({ places, hotels = [], onMarkerClick, selectedPlaceId, mapLayer = 'standard', placeLabels, dayGroups }: LeafletMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hotelMarkersRef = useRef<Map<string, any>>(new Map());

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let active = true;

    import('leaflet').then((L) => {
      if (!active || !containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
        iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
        shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
      });

      const map = L.map(containerRef.current!, {
        center: [25.04, 102.72],
        zoom: 7,
        zoomControl: false,
      });

      const tileUrl = mapLayer === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attribution = mapLayer === 'satellite'
        ? '© Esri, Maxar, Earthstar Geographics'
        : '© OpenStreetMap contributors';
      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      // Scale bar — metric only
      L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

      mapRef.current = map;

      // Current device location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!active || !mapRef.current) return;
            const { latitude, longitude } = pos.coords;
            const locHtml = `
              <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
                <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:rgba(74,144,217,0.20);animation:loc-pulse 2s ease-out infinite;"></div>
                <div style="width:12px;height:12px;background:#4A90D9;border:2.5px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(74,144,217,0.5);position:relative;"></div>
              </div>`;
            const locIcon = L.divIcon({ html: locHtml, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mapRef.current as any)._locationMarker = L.marker([latitude, longitude], { icon: locIcon, zIndexOffset: 2000 })
              .addTo(mapRef.current)
              .bindTooltip('你在这里', { permanent: false, direction: 'top', offset: [0, -6] });
          },
          undefined,
          { timeout: 10000, enableHighAccuracy: false },
        );
      }
    });

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers + per-segment lines + distance labels when places change
  useEffect(() => {
    if (!mapRef.current) return;
    let active = true;

    import('leaflet').then((L) => {
      if (!active || !mapRef.current) return;
      const map = mapRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapEx = map as any;
      const currentIds = new Set(places.map((p) => p.id));

      // Remove stale place markers
      for (const [id, m] of markersRef.current) {
        if (!currentIds.has(id)) { m.remove(); markersRef.current.delete(id); }
      }

      // Add / update place markers
      places.forEach((place, idx) => {
        const isSelected = place.id === selectedPlaceId;
        const emoji = CATEGORY_EMOJI[place.category] ?? '📍';
        const color = CATEGORY_COLOR[place.category] ?? '#3A7A8C';
        const size = isSelected ? 46 : 38;
        const badge = placeLabels?.[place.id] ?? String(idx + 1);
        const badgeWide = badge.length > 2;
        const badgeW = badgeWide ? 26 : 17;
        const badgeH = 17;

        const html = `<div style="width:${size}px;height:${size}px;background:${isSelected ? color : '#fff'};border:2.5px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isSelected ? 22 : 17}px;box-shadow:0 3px 12px rgba(0,0,0,0.18);position:relative;">
          ${emoji}
          <span style="position:absolute;top:-7px;right:-${Math.max(7, badgeW / 2)}px;background:${color};color:#fff;font-size:9px;font-weight:700;min-width:${badgeW}px;height:${badgeH}px;padding:0 4px;border-radius:9px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;white-space:nowrap;">${badge}</span>
        </div>`;

        const icon = L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

        if (markersRef.current.has(place.id)) {
          markersRef.current.get(place.id).setIcon(icon).setLatLng([place.location.lat, place.location.lng]);
        } else {
          const m = L.marker([place.location.lat, place.location.lng], { icon })
            .addTo(map)
            .on('click', () => { onMarkerClick?.(place); if (navigator.vibrate) navigator.vibrate(10); });
          markersRef.current.set(place.id, m);
        }
      });

      // Remove old segment layers (lines + labels)
      if (mapEx._travelLayers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapEx._travelLayers.forEach((l: any) => l.remove());
      }
      mapEx._travelLayers = [];

      // Build a lookup for quick access
      const placeById = new Map(places.map((p) => [p.id, p]));

      // Determine which groups to draw
      // - If dayGroups provided, draw each group in its own colour
      // - Otherwise treat all places as one implicit group (legacy behaviour)
      const groups = dayGroups && dayGroups.length > 0
        ? dayGroups.map((g) => ({
            color: DAY_COLORS[g.dayIndex % DAY_COLORS.length],
            placeIds: g.placeIds,
          }))
        : [{ color: '#3A7A8C', placeIds: places.map((p) => p.id) }];

      for (const group of groups) {
        const groupPlaces = group.placeIds.map((id) => placeById.get(id)).filter(Boolean) as PlaceVisit[];
        if (groupPlaces.length < 2) continue;

        for (let i = 0; i < groupPlaces.length - 1; i++) {
          const a = groupPlaces[i];
          const b = groupPlaces[i + 1];

          const seg = L.polyline(
            [[a.location.lat, a.location.lng], [b.location.lat, b.location.lng]],
            { color: group.color, weight: 2.5, opacity: 0.7, dashArray: '8,5' },
          ).addTo(map);
          mapEx._travelLayers.push(seg);

          const midLat = (a.location.lat + b.location.lat) / 2;
          const midLng = (a.location.lng + b.location.lng) / 2;
          const km = haversineKm(a.location, b.location);
          const label = formatDist(km);

          const labelHtml = `<div style="transform:translate(-50%,-50%);background:rgba(255,255,255,0.92);border:1px solid ${group.color}55;border-radius:8px;padding:2px 7px;font-size:10px;font-weight:600;color:${group.color};white-space:nowrap;box-shadow:0 1px 6px rgba(0,0,0,0.13);pointer-events:none;">${label}</div>`;
          const labelIcon = L.divIcon({ html: labelHtml, className: '', iconSize: [0, 0], iconAnchor: [0, 0] });
          const labelMarker = L.marker([midLat, midLng], { icon: labelIcon, interactive: false }).addTo(map);
          mapEx._travelLayers.push(labelMarker);
        }
      }

      // Fit view
      if (places.length === 1) {
        map.setView([places[0].location.lat, places[0].location.lng], 13, { animate: true });
      } else if (places.length > 1) {
        map.fitBounds(L.latLngBounds(places.map((p) => [p.location.lat, p.location.lng] as [number, number])), { padding: [60, 60] });
      }
    });

    return () => { active = false; };
  }, [places, selectedPlaceId, onMarkerClick, placeLabels, dayGroups]);

  // Sync hotel markers
  useEffect(() => {
    if (!mapRef.current) return;
    let active = true;
    import('leaflet').then((L) => {
      if (!active || !mapRef.current) return;
      const map = mapRef.current;
      const currentIds = new Set(hotels.map((h) => h.id));

      for (const [id, m] of hotelMarkersRef.current) {
        if (!currentIds.has(id)) { m.remove(); hotelMarkersRef.current.delete(id); }
      }

      hotels.forEach((hotel) => {
        if (hotel.location.lat === 0 && hotel.location.lng === 0) return;
        const html = `<div style="width:40px;height:40px;background:linear-gradient(135deg,#6B7FA8,#4A6080);border:2.5px solid white;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 12px rgba(107,127,168,0.35);">🏨</div>`;
        const icon = L.divIcon({ html, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
        if (!hotelMarkersRef.current.has(hotel.id)) {
          const m = L.marker([hotel.location.lat, hotel.location.lng], { icon, zIndexOffset: 500 })
            .addTo(map)
            .bindTooltip(hotel.name, { permanent: false, direction: 'top', offset: [0, -8] });
          hotelMarkersRef.current.set(hotel.id, m);
        } else {
          hotelMarkersRef.current.get(hotel.id).setLatLng([hotel.location.lat, hotel.location.lng]).setIcon(icon);
        }
      });
    });
    return () => { active = false; };
  }, [hotels]);

  return (
    <>
      <style>{`
        @keyframes loc-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </>
  );
}
