import type { PlannedStop } from '../../types/trip';

const STOP_ICON: Record<string, string> = {
  hotel_depart: '🏨', hotel_arrive: '🏨',
  place: '📍', lunch: '🍜', dinner: '🍽️', transport: '🚗',
};

const MODE_ICON: Record<string, string> = {
  driving: '🚗', walking: '🚶', transit: '🚌', cycling: '🚴',
};

interface StopCardProps {
  stop: PlannedStop;
  isLast: boolean;
}

export function StopCard({ stop, isLast }: StopCardProps) {
  const isHotel = stop.type === 'hotel_depart' || stop.type === 'hotel_arrive';
  const isMeal = stop.type === 'lunch' || stop.type === 'dinner';

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center flex-none" style={{ width: 32 }}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0"
          style={{
            background: isHotel
              ? 'linear-gradient(135deg,#6B7FA8,#4A6080)'
              : isMeal
              ? 'linear-gradient(135deg,#C85A3E,#A04030)'
              : 'linear-gradient(135deg,rgba(58,122,140,0.85),rgba(44,95,107,0.85))',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {STOP_ICON[stop.type] ?? '📍'}
        </div>
        {!isLast && (
          <div style={{ flex: 1, width: 2, minHeight: 24, background: 'var(--color-divider)', marginTop: 4 }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            {stop.name}
          </span>
          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--color-primary)' }}>
            {stop.arrivalTime}–{stop.departureTime}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            停留 {stop.durationMinutes >= 60
              ? `${Math.floor(stop.durationMinutes / 60)}h${stop.durationMinutes % 60 > 0 ? `${stop.durationMinutes % 60}m` : ''}`
              : `${stop.durationMinutes}m`}
          </span>

          {stop.transportToNext && (
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              · {MODE_ICON[stop.transportToNext.mode]} {stop.transportToNext.durationMinutes}分钟
              {stop.transportToNext.distanceKm > 0 && ` (${stop.transportToNext.distanceKm.toFixed(1)}km)`}
            </span>
          )}
        </div>

        {stop.notes && (
          <div
            className="mt-1.5 px-2.5 py-1.5 rounded-xl text-[11px] leading-relaxed"
            style={{ backgroundColor: 'rgba(58,122,140,0.07)', color: 'var(--color-text-secondary)' }}
          >
            💡 {stop.notes}
          </div>
        )}

        {stop.weatherWarning && (
          <div
            className="mt-1 px-2.5 py-1.5 rounded-xl text-[11px] leading-relaxed"
            style={{ backgroundColor: 'rgba(200,90,62,0.07)', color: 'var(--color-accent)' }}
          >
            ⛅ {stop.weatherWarning}
          </div>
        )}
      </div>
    </div>
  );
}
