import { useState, useEffect } from 'react';
import { X, Clock, Star, Ticket, Mountain, MapPin, Plus, CloudSun, RefreshCw } from 'lucide-react';
import type { PlaceVisit, Priority, NoteColor, NoteMood, WeatherInfo } from '../../types/trip';
import { NoteCard } from '../Notes/NoteCard';
import { AddNoteSheet } from '../Notes/AddNoteSheet';
import { getWeatherForDate } from '../../services/weather/openmeteo';

interface PlaceDetailProps {
  place: PlaceVisit;
  dayDate: string;
  onClose: () => void;
  onUpdate: (patch: Partial<PlaceVisit>) => void;
  onAddNote: (content: string, color: NoteColor, mood?: NoteMood) => void;
  onRemoveNote: (noteId: string) => void;
  onUpdateNote: (noteId: string, patch: Partial<import('../../types/trip').PlaceNote>) => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'must', label: '必去', color: '#C85A3E' },
  { value: 'want', label: '想去', color: '#8BA888' },
  { value: 'maybe', label: '备选', color: '#6B7FA8' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  nature: '🏔️', heritage: '🏯', food: '🍜',
  hotel: '🏨', transport: '🚆', shopping: '🛍️', activity: '🎯',
};

const WEATHER_ICONS: Record<string, string> = {
  晴: '☀️', 多云: '⛅', 阴: '☁️', 雨: '🌧️', 雪: '❄️', 雾: '🌫️',
};
function weatherEmoji(condition: string) {
  for (const [key, emoji] of Object.entries(WEATHER_ICONS)) {
    if (condition.includes(key)) return emoji;
  }
  return '🌤️';
}

export function PlaceDetail({ place, dayDate, onClose, onUpdate, onAddNote, onRemoveNote, onUpdateNote }: PlaceDetailProps) {
  const [showAddNote, setShowAddNote] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const altitude = place.location.altitude ?? 0;

  const fetchWeather = async (lat: number, lng: number, date: string) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const w = await getWeatherForDate(lat, lng, date);
      setWeather(w);
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : '天气获取失败');
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (place.location.lat && place.location.lng && dayDate) {
      fetchWeather(place.location.lat, place.location.lng, dayDate);
    }
  // Only re-fetch when the place or date changes (not on every render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, dayDate]);
  const durationHours = Math.floor(place.durationMinutes / 60);
  const durationMins = place.durationMinutes % 60;
  const notes = place.notes ?? [];

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Hero image area */}
        <div className="relative h-48 flex-shrink-0 overflow-hidden rounded-t-3xl"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
        >
          {place.imageUrl ? (
            <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-7xl opacity-50">{CATEGORY_EMOJI[place.category] ?? '📍'}</span>
            </div>
          )}
          {/* Double gradient overlay for depth */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 40%)' }} />

          <button
            className="tap absolute top-3 right-3 w-8 h-8 rounded-full glass-dark flex items-center justify-center"
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} className="text-white" />
          </button>
          <div className="absolute bottom-3 left-4 right-12">
            <h2 className="text-[22px] font-semibold text-white leading-tight drop-shadow">{place.name}</h2>
            {place.address && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin size={11} strokeWidth={1.5} className="text-white opacity-70" />
                <span className="text-[12px] text-white opacity-70 truncate">{place.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Details scroll area */}
        <div className="flex-1 overflow-y-auto scroll-ios px-4 pt-4 pb-safe-bottom space-y-4">

          {/* Stats row */}
          <div className="flex items-center gap-2 flex-wrap">
            {place.rating != null && place.rating > 0 && (
              <div className="flex items-center gap-1 pill badge-heritage">
                <Star size={11} strokeWidth={1.5} style={{ fill: '#D4A574', color: '#D4A574' }} />
                <span>{place.rating.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-1 pill badge-nature">
              <Clock size={11} strokeWidth={1.5} />
              <span>停留 {durationHours > 0 ? `${durationHours}h` : ''}{durationMins > 0 ? `${durationMins}m` : ''}</span>
            </div>
            {place.ticketRequired && (
              <div className="flex items-center gap-1 pill badge-food">
                <Ticket size={11} strokeWidth={1.5} />
                <span>需购票{place.ticketPrice != null ? ` ¥${place.ticketPrice}` : ''}</span>
              </div>
            )}
            {altitude > 0 && (
              <div className="flex items-center gap-1 pill badge-altitude">
                <Mountain size={11} strokeWidth={1.5} />
                <span>{altitude}m</span>
              </div>
            )}
          </div>

          {/* High altitude warning */}
          {altitude > 2500 && (
            <div className="px-3 py-2.5 rounded-2xl" style={{ backgroundColor: 'rgba(107, 127, 168, 0.1)', border: '1px solid rgba(107,127,168,0.2)' }}>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--color-altitude)' }}>⚠️ 高海拔提醒</div>
              <div className="text-[12px] text-muted mt-0.5">
                该地点海拔 {altitude}m，{altitude > 3000 ? '可能出现高原反应，建议提前备好高反药物，初到时减少剧烈运动' : '注意气候干燥，日照强烈，做好防晒'}。
              </div>
            </div>
          )}

          {/* Weather card — per-place, fetched from this place's own coordinates */}
          {weatherLoading ? (
            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 animate-spin-slow flex-shrink-0" style={{ borderColor: 'var(--color-divider)', borderTopColor: 'var(--color-primary)' }} />
              <span className="text-[13px] text-muted">正在获取天气…</span>
            </div>
          ) : weatherError ? (
            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-[13px] text-muted flex-1">天气获取失败</span>
              <button
                className="tap flex items-center gap-1 text-[12px] text-primary"
                onClick={() => fetchWeather(place.location.lat, place.location.lng, dayDate)}
              >
                <RefreshCw size={12} strokeWidth={1.5} />
                重试
              </button>
            </div>
          ) : weather ? (
            <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-4">
              <span className="text-[28px]">{weatherEmoji(weather.condition)}</span>
              <div className="flex-1">
                <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
                  {weather.condition} · {weather.high}°/{weather.low}°
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {weather.precipProbability != null && (
                    <span className="text-[11px] text-muted">💧 降水 {weather.precipProbability}%</span>
                  )}
                  {weather.uvIndex != null && weather.uvIndex > 0 && (
                    <span className="text-[11px] text-muted">☀️ UV {weather.uvIndex}</span>
                  )}
                  {weather.windSpeed != null && weather.windSpeed > 0 && (
                    <span className="text-[11px] text-muted">💨 {weather.windSpeed}km/h</span>
                  )}
                </div>
              </div>
              <CloudSun size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            </div>
          ) : null}

          {/* Priority selector */}
          <div>
            <div className="text-[13px] font-medium text-muted mb-2">优先级</div>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className="tap flex-1 py-2 rounded-xl text-[13px] font-medium"
                  style={{
                    backgroundColor: place.priority === opt.value ? opt.color : 'var(--color-divider)',
                    color: place.priority === opt.value ? 'white' : 'var(--color-text-secondary)',
                    transition: 'all 150ms var(--ease-ios)',
                  }}
                  onClick={() => onUpdate({ priority: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] font-medium text-muted">停留时长</span>
              <span className="text-[13px] font-semibold text-primary">
                {durationHours > 0 ? `${durationHours} 小时` : ''}{durationMins > 0 ? ` ${durationMins} 分钟` : ''}
              </span>
            </div>
            <input
              type="range" min={15} max={480} step={15}
              value={place.durationMinutes}
              onChange={(e) => onUpdate({ durationMinutes: Number(e.target.value) })}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-subtle mt-0.5">
              <span>15 分钟</span><span>8 小时</span>
            </div>
          </div>

          {/* Opening hours */}
          {place.openingHours && (
            <div>
              <div className="text-[13px] font-medium text-muted mb-1">开放时间</div>
              <div className="text-[13px]" style={{ color: 'var(--color-text)' }}>{place.openingHours}</div>
            </div>
          )}

          {/* Notes — hand-journal style */}
          <div className="pb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>📝 旅行笔记</span>
              <button
                className="tap flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-medium text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
                onClick={() => setShowAddNote(true)}
              >
                <Plus size={12} strokeWidth={2.5} />
                添加
              </button>
            </div>
            {notes.length === 0 ? (
              <button
                className="tap w-full py-4 rounded-2xl border-2 border-dashed text-[13px] text-muted flex flex-col items-center gap-1"
                style={{ borderColor: 'var(--color-divider)' }}
                onClick={() => setShowAddNote(true)}
              >
                <span className="text-[22px]">✏️</span>
                记录你的旅行感受…
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onDelete={() => onRemoveNote(note.id)}
                    onUpdate={(patch) => onUpdateNote(note.id, patch)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddNote && (
        <AddNoteSheet
          onSave={onAddNote}
          onClose={() => setShowAddNote(false)}
        />
      )}
    </>
  );
}
