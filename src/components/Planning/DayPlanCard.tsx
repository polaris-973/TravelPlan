import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PlannedDay } from '../../types/trip';
import { StopCard } from './StopCard';

interface DayPlanCardProps {
  day: PlannedDay;
  dayNumber: number;
}

function weatherEmoji(condition: string) {
  if (/雨/.test(condition)) return '🌧️';
  if (/雪/.test(condition)) return '❄️';
  if (/多云/.test(condition)) return '⛅';
  if (/阴/.test(condition)) return '☁️';
  if (/晴/.test(condition)) return '☀️';
  return '🌤️';
}

export function DayPlanCard({ day, dayNumber }: DayPlanCardProps) {
  const [expanded, setExpanded] = useState(dayNumber === 1);

  const placeStops = day.stops.filter((s) => s.type === 'place');
  const date = new Date(day.date);
  const dateLabel = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });

  return (
    <div
      className="rounded-2xl overflow-hidden glass-card mb-3"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <button
        className="tap w-full flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold flex-shrink-0 text-white"
            style={{ background: 'linear-gradient(135deg,rgba(58,122,140,0.85),rgba(44,95,107,0.85))' }}
          >
            D{dayNumber}
          </div>
          <div className="text-left">
            <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>{dateLabel}</div>
            <div className="text-[11px] text-muted">{placeStops.length} 个景点</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {day.weather && (
            <div className="flex items-center gap-1">
              <span className="text-[13px]">{weatherEmoji(day.weather.condition)}</span>
              <span className="text-[11px] text-muted">{day.weather.high}°/{day.weather.low}°</span>
            </div>
          )}
          {expanded
            ? <ChevronUp size={15} strokeWidth={1.5} className="text-subtle" />
            : <ChevronDown size={15} strokeWidth={1.5} className="text-subtle" />
          }
        </div>
      </button>

      {/* AI Summary */}
      {expanded && day.aiSummary && (
        <div
          className="mx-4 mb-3 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed"
          style={{ backgroundColor: 'rgba(58,122,140,0.06)', color: 'var(--color-text-secondary)', borderLeft: '3px solid rgba(58,122,140,0.3)' }}
        >
          {day.aiSummary}
        </div>
      )}

      {/* Timeline */}
      {expanded && (
        <div className="px-4 pb-4">
          {day.stops.map((stop, i) => (
            <StopCard key={`${stop.type}-${i}`} stop={stop} isLast={i === day.stops.length - 1} />
          ))}

          {day.totalTravelMinutes > 0 && (
            <div className="mt-2 text-[11px] text-muted text-right">
              总行程约 {Math.round(day.totalDistanceKm)}km · 交通 {day.totalTravelMinutes}分钟
            </div>
          )}
        </div>
      )}
    </div>
  );
}
