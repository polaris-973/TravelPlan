import { useEffect, useRef, useState, useCallback } from 'react';
import { loadAMap } from '../../services/amap/loader';
import type { PlaceVisit } from '../../types/trip';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AMap = any;

interface MapViewProps {
  apiKey: string;
  places: PlaceVisit[];
  onMarkerClick?: (place: PlaceVisit) => void;
  onMapLongPress?: (lng: number, lat: number) => void;
  selectedPlaceId?: string | null;
  mapLayer?: 'standard' | 'satellite';
}

const CATEGORY_COLORS: Record<string, string> = {
  nature: '#8BA888',
  heritage: '#D4A574',
  food: '#C85A3E',
  hotel: '#6B7FA8',
  transport: '#A1A1A6',
  shopping: '#D4A574',
  activity: '#3A7A8C',
};

const CATEGORY_ICONS: Record<string, string> = {
  nature: '🏔️',
  heritage: '🏯',
  food: '🍜',
  hotel: '🏨',
  transport: '🚆',
  shopping: '🛍️',
  activity: '🎯',
};

export function MapView({ apiKey, places, onMarkerClick, onMapLongPress, selectedPlaceId, mapLayer = 'standard' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMap | null>(null);
  const markersRef = useRef<Map<string, AMap>>(new Map());
  const polylineRef = useRef<AMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialize map
  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let destroyed = false;

    loadAMap(apiKey).then((AMap) => {
      if (destroyed || !containerRef.current) return;

      const map = new AMap.Map(containerRef.current, {
        zoom: 8,
        center: [102.7183, 25.0406], // Kunming
        mapStyle: mapLayer === 'satellite' ? 'amap://styles/satellite' : 'amap://styles/whitesmoke',
        features: ['bg', 'road', 'building', 'point'],
        resizeEnable: true,
      });

      mapRef.current = map;
      setMapReady(true);

      // Long press to add place
      let pressStartPos: [number, number] | null = null;
      map.on('mousedown', (e: AMap) => {
        pressStartPos = [e.lnglat.getLng(), e.lnglat.getLat()];
        longPressTimer.current = setTimeout(() => {
          if (pressStartPos && onMapLongPress) {
            onMapLongPress(pressStartPos[0], pressStartPos[1]);
            if (navigator.vibrate) navigator.vibrate(20);
          }
        }, 600);
      });
      map.on('mouseup', () => { clearTimeout(longPressTimer.current); pressStartPos = null; });
      map.on('dragging', () => { clearTimeout(longPressTimer.current); pressStartPos = null; });

    }).catch((e) => {
      setLoadError(e.message);
    });

    return () => {
      destroyed = true;
      clearTimeout(longPressTimer.current);
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Sync markers
  const syncMarkers = useCallback(() => {
    if (!mapReady || !mapRef.current) return;
    const AMapLib = window.AMap;
    if (!AMapLib) return;

    const currentIds = new Set(places.map((p) => p.id));
    const existingIds = new Set(markersRef.current.keys());

    // Remove stale markers
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        markersRef.current.get(id)?.setMap(null);
        markersRef.current.delete(id);
      }
    }

    // Add or update markers
    places.forEach((place, idx) => {
      const isSelected = place.id === selectedPlaceId;
      const color = CATEGORY_COLORS[place.category] ?? '#3A7A8C';
      const icon = CATEGORY_ICONS[place.category] ?? '📍';

      const markerContent = `
        <div style="
          display:flex;align-items:center;justify-content:center;
          width:${isSelected ? 44 : 36}px;height:${isSelected ? 44 : 36}px;
          background:${isSelected ? color : 'white'};
          border:2.5px solid ${color};
          border-radius:50%;
          box-shadow:0 4px 12px rgba(0,0,0,0.15);
          font-size:${isSelected ? 20 : 16}px;
          transition:all 0.2s;
          position:relative;
        ">
          ${icon}
          <span style="
            position:absolute;top:-6px;right:-6px;
            background:${color};color:white;
            font-size:9px;font-weight:700;
            width:16px;height:16px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            border:1.5px solid white;
          ">${idx + 1}</span>
        </div>
      `;

      if (markersRef.current.has(place.id)) {
        const m = markersRef.current.get(place.id);
        m?.setContent(markerContent);
        m?.setPosition([place.location.lng, place.location.lat]);
      } else {
        const marker = new AMapLib.Marker({
          position: [place.location.lng, place.location.lat],
          content: markerContent,
          offset: new AMapLib.Pixel(-18, -18),
          zIndex: isSelected ? 110 : 100,
        });
        marker.on('click', () => { onMarkerClick?.(place); if (navigator.vibrate) navigator.vibrate(10); });
        marker.setMap(mapRef.current);
        markersRef.current.set(place.id, marker);
      }
    });

    // Draw route polyline between places (manage separately, no clearMap)
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (places.length > 1) {
      const path = places.map((p) => [p.location.lng, p.location.lat]);
      polylineRef.current = new AMapLib.Polyline({
        path,
        strokeColor: '#3A7A8C',
        strokeWeight: 3,
        strokeOpacity: 0.7,
        strokeDasharray: [10, 5],
        map: mapRef.current,
      });
    }
  }, [mapReady, places, selectedPlaceId, onMarkerClick]);

  useEffect(() => { syncMarkers(); }, [syncMarkers]);

  // Fit map to places
  useEffect(() => {
    if (!mapReady || !mapRef.current || places.length === 0) return;
    const AMapLib = window.AMap;
    if (!AMapLib) return;
    if (places.length === 1) {
      mapRef.current.setCenter([places[0].location.lng, places[0].location.lat]);
      mapRef.current.setZoom(13);
    } else {
      const bounds = new AMapLib.Bounds(
        [Math.min(...places.map((p) => p.location.lng)), Math.min(...places.map((p) => p.location.lat))],
        [Math.max(...places.map((p) => p.location.lng)), Math.max(...places.map((p) => p.location.lat))],
      );
      mapRef.current.setBounds(bounds, false, [60, 60, 300, 60]);
    }
  }, [mapReady, places.length, places]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-app">
        <div className="text-4xl">🗺️</div>
        <div className="text-[15px] font-medium" style={{ color: 'var(--color-text)' }}>地图加载失败</div>
        <div className="text-[13px] text-muted text-center px-8">{loadError}</div>
        <div className="text-[12px] text-subtle">请检查高德地图 API Key 是否正确配置</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-app">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-3 border-transparent border-t-primary animate-spin-slow" style={{ borderWidth: 3, borderTopColor: 'var(--color-primary)' }} />
            <span className="text-[13px] text-muted">加载地图中…</span>
          </div>
        </div>
      )}
    </div>
  );
}
