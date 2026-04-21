import { useState } from 'react';
import { ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import type { PlaceVisit, TransportOption, TransportMode, Location, RouteSegment } from '../../types/trip';
import { getRouteOptions } from '../../services/amap/routing';

const MODE_ICON: Record<TransportMode, string> = {
  walking: '🚶', cycling: '🚴', driving: '🚗',
  transit: '🚌', flight: '✈️', highspeedrail: '🚄',
};
const MODE_LABEL: Record<TransportMode, string> = {
  walking: '步行', cycling: '骑行', driving: '驾车',
  transit: '公交', flight: '飞机', highspeedrail: '高铁',
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

function buildAmapNavUrl(from: PlaceVisit, to: PlaceVisit, mode: TransportMode): string {
  const modeMap: Record<string, number> = { driving: 0, transit: 2, walking: 3, cycling: 4 };
  const t = modeMap[mode] ?? 0;
  return `https://uri.amap.com/navigation?from=${from.location.lng},${from.location.lat},${encodeURIComponent(from.name)}&to=${to.location.lng},${to.location.lat},${encodeURIComponent(to.name)}&mode=${t}&callnative=1`;
}

interface RouteConnectorProps {
  from: PlaceVisit;
  to: PlaceVisit;
  amapApiKey?: string;
  /** AI-planned segment (from SmartPlan.transport_to_next). If present, show AI-predicted duration by default. */
  planned?: RouteSegment;
}

export function RouteConnector({ from, to, amapApiKey, planned }: RouteConnectorProps) {
  const [options, setOptions] = useState<TransportOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const distKm = haversineKm(from.location, to.location);
  const distLabel = formatDist(distKm);

  const plannedMinutes = planned ? Math.round(planned.durationSeconds / 60) : 0;
  const plannedKm = planned ? planned.distanceMeters / 1000 : 0;

  const calculate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!amapApiKey || loading) return;
    setLoading(true);
    try {
      const opts = await getRouteOptions(amapApiKey, from.location, to.location);
      setOptions(opts);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
    if (navigator.vibrate) navigator.vibrate(8);
  };

  const best = options?.[0];

  return (
    <div className="px-3 py-0.5">
      <div className="flex items-center gap-2 ml-2.5">
        {/* Vertical dashed connecting line */}
        <div className="flex-none self-stretch" style={{ width: 1, background: 'repeating-linear-gradient(to bottom, var(--color-divider) 0px, var(--color-divider) 4px, transparent 4px, transparent 8px)' }} />

        <div className="flex items-center gap-1.5 py-1 flex-wrap">
          {/* AI-planned segment (pre-computed from SmartPlan) */}
          {planned && (
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(58,122,140,0.1)', color: 'var(--color-primary)' }}
              title={`AI 规划：${MODE_LABEL[planned.mode]} ${plannedMinutes}分钟 · ${plannedKm.toFixed(1)}km`}
            >
              {MODE_ICON[planned.mode]} {plannedMinutes}分 · {plannedKm.toFixed(1)}km
            </span>
          )}

          {/* Straight-line distance — always shown */}
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            直线 {distLabel}
          </span>

          {/* Best real-route result once fetched */}
          {best && (
            <>
              <span style={{ color: 'var(--color-divider)', fontSize: 11 }}>·</span>
              <button
                className="tap flex items-center gap-0.5 text-[11px] font-semibold"
                style={{ color: 'var(--color-primary)' }}
                onClick={() => setExpanded(!expanded)}
              >
                <span>{MODE_ICON[best.mode]}</span>
                <span>{best.label}</span>
                {expanded ? <ChevronUp size={9} strokeWidth={2} /> : <ChevronDown size={9} strokeWidth={2} />}
              </button>
            </>
          )}

          {/* Fetch route — only when Amap key present and not yet fetched */}
          {amapApiKey && !options && (
            <>
              <span style={{ color: 'var(--color-divider)', fontSize: 11 }}>·</span>
              <button
                className="tap flex items-center gap-1 text-[11px]"
                style={{ color: 'var(--color-text-tertiary)' }}
                onClick={calculate}
              >
                {loading
                  ? <div className="w-2.5 h-2.5 rounded-full border animate-spin-slow" style={{ borderColor: 'var(--color-divider)', borderTopColor: 'var(--color-primary)' }} />
                  : <Navigation size={10} strokeWidth={1.5} />
                }
                {loading ? '计算中…' : '查路程'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded — all transport options with nav links */}
      {expanded && options && (
        <div
          className="mt-1 ml-5 rounded-2xl overflow-hidden glass-card animate-fade-in-up"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          {options.map((opt, i) => (
            <a
              key={opt.mode}
              href={buildAmapNavUrl(from, to, opt.mode)}
              target="_blank"
              rel="noopener noreferrer"
              className="tap flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom: i < options.length - 1 ? '1px solid var(--color-divider)' : undefined,
                textDecoration: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[15px] w-5 text-center flex-shrink-0">{MODE_ICON[opt.mode]}</span>
              <span className="text-[12px] font-medium flex-shrink-0" style={{ color: 'var(--color-text-secondary)', width: 28 }}>
                {MODE_LABEL[opt.mode]}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--color-primary)' }}>
                {opt.label}
              </span>
              <span className="ml-auto text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>导航 →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
