import { useState } from 'react';
import { Trash2, GripVertical, Clock, Star, ChevronRight, Flag } from 'lucide-react';
import type { PlaceVisit } from '../../types/trip';

const CATEGORY_ICON: Record<string, string> = {
  nature: '🏔️', heritage: '🏯', food: '🍜',
  hotel: '🏨', transport: '🚆', shopping: '🛍️', activity: '🎯',
};

const PRIORITY_LABEL: Record<string, string> = { must: '必去', want: '想去', maybe: '备选' };
const PRIORITY_COLOR: Record<string, string> = {
  must: 'badge-food',
  want: 'badge-nature',
  maybe: 'badge-hotel',
};

interface PlaceCardProps {
  place: PlaceVisit;
  index: number;
  /** Optional day number for "D{dayNumber}-{index+1}" badge label */
  dayNumber?: number;
  onDelete?: () => void;
  onPress?: () => void;
  onDurationChange?: (minutes: number) => void;
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function PlaceCard({ place, index, dayNumber, onDelete, onPress, onDurationChange }: PlaceCardProps) {
  const [showDuration, setShowDuration] = useState(false);
  const arrival = formatTime(place.arrivalTime);
  const departure = formatTime(place.departureTime);

  return (
    <div className="relative flex items-start gap-3 px-4 py-3 glass-card rounded-2xl animate-fade-in-up"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)' }}
    >
      {/* Index + drag handle */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span
          className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
          style={{
            minWidth: dayNumber != null ? 36 : 24,
            height: 24,
            padding: dayNumber != null ? '0 6px' : 0,
            fontSize: dayNumber != null ? 10 : 11,
            background: 'linear-gradient(135deg, rgba(58,122,140,0.9), rgba(44,95,107,0.9))',
            boxShadow: '0 1px 4px rgba(58,122,140,0.25)',
          }}
        >
          {dayNumber != null ? `D${dayNumber}-${index + 1}` : index + 1}
        </span>
        <GripVertical size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} className="cursor-grab" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={onPress}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[17px]">{CATEGORY_ICON[place.category] ?? '📍'}</span>
            <span className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>{place.name}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`pill ${PRIORITY_COLOR[place.priority]}`}>{PRIORITY_LABEL[place.priority]}</span>
            <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {arrival && departure && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
              style={{ backgroundColor: 'rgba(58,122,140,0.1)', color: 'var(--color-primary)' }}
            >
              <Clock size={10} strokeWidth={2} />
              {arrival} → {departure}
            </span>
          )}
          <button
            className="tap flex items-center gap-1"
            onClick={(e) => { e.stopPropagation(); setShowDuration(!showDuration); }}
          >
            {!arrival && <Clock size={12} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />}
            <span className="text-[12px] text-muted">
              {Math.floor(place.durationMinutes / 60) > 0 ? `${Math.floor(place.durationMinutes / 60)}h` : ''}
              {place.durationMinutes % 60 > 0 ? `${place.durationMinutes % 60}m` : ''}
            </span>
          </button>
          {place.rating != null && place.rating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star size={11} strokeWidth={1.5} style={{ color: '#D4A574', fill: '#D4A574' }} />
              <span className="text-[12px] text-muted">{place.rating.toFixed(1)}</span>
            </div>
          )}
          {place.ticketRequired && (
            <span className="pill badge-heritage text-[10px]">需购票</span>
          )}
          {(place.location.altitude ?? 0) > 2500 && (
            <span className="pill badge-altitude text-[10px]">⛰ 高海拔</span>
          )}
        </div>

        {showDuration && (
          <div className="mt-2.5">
            <input
              type="range" min={15} max={480} step={15}
              value={place.durationMinutes}
              onChange={(e) => onDurationChange?.(Number(e.target.value))}
              className="w-full accent-primary"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex justify-between text-[11px] text-subtle mt-0.5">
              <span>15 分钟</span><span>8 小时</span>
            </div>
          </div>
        )}

        {place.notes?.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[12px] text-muted">
            <Flag size={10} strokeWidth={1.5} className="inline flex-shrink-0" />
            <span className="truncate">{place.notes[0].content}</span>
            {place.notes.length > 1 && <span className="text-primary flex-shrink-0">+{place.notes.length - 1}</span>}
          </div>
        )}
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          className="tap flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(200, 90, 62, 0.08)' }}
          onClick={(e) => { e.stopPropagation(); onDelete(); if (navigator.vibrate) navigator.vibrate(10); }}
        >
          <Trash2 size={14} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
        </button>
      )}
    </div>
  );
}
