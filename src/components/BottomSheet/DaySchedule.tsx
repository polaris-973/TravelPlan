import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Hotel as HotelIcon, Trash2 } from 'lucide-react';
import { PlaceCard } from '../PlaceCard/PlaceCard';
import { RouteConnector } from '../Route/RouteConnector';
import { getWeatherForDate } from '../../services/weather/openmeteo';
import { useSettingsStore } from '../../store/settingsStore';
import { geocode } from '../../services/amap/loader';
import type { Day, PlaceVisit, WeatherInfo, Hotel } from '../../types/trip';

interface DayScheduleProps {
  day: Day;
  dayIndex: number;
  /** Total number of days in the trip — used to determine next date for hotel check-out. */
  tripDaysCount?: number;
  /** All hotels on the trip — we find the one covering this day's date. */
  hotels?: Hotel[];
  onPlaceDelete: (placeId: string) => void;
  onPlacePress: (place: PlaceVisit) => void;
  onPlaceDurationChange: (placeId: string, minutes: number) => void;
  onAddPlace?: () => void;
  onWeatherFetched?: (weather: WeatherInfo) => void;
  onAddHotel?: (hotel: Hotel) => void;
  onRemoveHotel?: (hotelId: string) => void;
}

function nanoid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

/** Find hotel whose checkIn <= date < checkOut (i.e. staying overnight on `date`). */
function findHotelForNight(hotels: Hotel[] | undefined, date: string): Hotel | undefined {
  if (!hotels?.length) return undefined;
  const d = new Date(date + 'T12:00:00').getTime();
  return hotels.find((h) => {
    const ci = new Date(h.checkInDate + 'T12:00:00').getTime();
    const co = new Date(h.checkOutDate + 'T12:00:00').getTime();
    return d >= ci && d < co;
  });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function weatherEmoji(condition: string) {
  if (/雨/.test(condition)) return '🌧️';
  if (/雪/.test(condition)) return '❄️';
  if (/多云/.test(condition)) return '⛅';
  if (/阴/.test(condition)) return '☁️';
  if (/晴/.test(condition)) return '☀️';
  return '🌤️';
}

export function DaySchedule({
  day, dayIndex, tripDaysCount, hotels,
  onPlaceDelete, onPlacePress, onPlaceDurationChange, onAddPlace, onWeatherFetched,
  onAddHotel, onRemoveHotel,
}: DayScheduleProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [addingHotel, setAddingHotel] = useState(false);
  const [hotelForm, setHotelForm] = useState({ name: '', address: '', notes: '' });
  const [hotelSubmitting, setHotelSubmitting] = useState(false);
  const config = useSettingsStore((s) => s.config);

  const currentHotel = findHotelForNight(hotels, day.date);
  // Hotel covers: checkIn this day, checkOut tomorrow (or end of trip if last day)
  const isLastDay = tripDaysCount != null && dayIndex === tripDaysCount - 1;
  const defaultCheckOut = isLastDay ? day.date : addDays(day.date, 1);

  const fetchWeather = useCallback(async () => {
    if (day.places.length === 0 || day.weather) return;
    const firstPlace = day.places[0];
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const w = await getWeatherForDate(
        firstPlace.location.lat,
        firstPlace.location.lng,
        day.date,
      );
      if (w) {
        onWeatherFetched?.(w);
      } else {
        setWeatherError('未获取到该日期天气');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '天气请求失败';
      setWeatherError(msg);
      console.error('[Weather]', msg);
    } finally {
      setWeatherLoading(false);
    }
  }, [day.places, day.weather, day.date, onWeatherFetched]);

  // Auto-fetch when expanded, places exist, no weather yet
  useEffect(() => {
    if (!collapsed && !day.weather && !weatherLoading && !weatherError && day.places.length > 0) {
      fetchWeather();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, day.weather, day.date, day.places.length]);

  const date = new Date(day.date);
  const dateLabel = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
  const totalMinutes = day.places.reduce((sum, p) => sum + p.durationMinutes, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remaining = totalMinutes % 60;

  return (
    <div className="mb-4">
      {/* Day header */}
      <button
        className="tap w-full flex items-center justify-between px-4 py-3 glass-card rounded-2xl mb-2"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(58,122,140,0.85), rgba(44,95,107,0.85))',
              color: 'white',
              boxShadow: '0 2px 8px rgba(58,122,140,0.3)',
            }}
          >
            D{dayIndex + 1}
          </div>
          <div className="text-left">
            <div className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>{dateLabel}</div>
            <div className="text-[11px] text-muted">
              {day.places.length} 个地点
              {totalMinutes > 0 && ` · ${totalHours > 0 ? `${totalHours}h` : ''}${remaining > 0 ? `${remaining}m` : ''}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Weather display */}
          {day.weather ? (
            <div className="flex items-center gap-1" title={`天气来源：${day.places[0]?.name ?? ''} (${day.places[0]?.location.lat.toFixed(2)}, ${day.places[0]?.location.lng.toFixed(2)})`}>
              <span className="text-[15px]">{weatherEmoji(day.weather.condition)}</span>
              <span className="text-[12px] text-muted font-medium">{day.weather.high}°/{day.weather.low}°</span>
            </div>
          ) : weatherLoading ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin-slow" style={{ borderColor: 'var(--color-divider)', borderTopColor: 'var(--color-primary)' }} />
          ) : weatherError ? (
            <button
              className="tap flex items-center gap-1"
              onClick={(e) => { e.stopPropagation(); setWeatherError(null); fetchWeather(); }}
              title={weatherError}
            >
              <AlertCircle size={13} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
              <RefreshCw size={11} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
            </button>
          ) : day.places.length > 0 ? (
            <button
              className="tap"
              onClick={(e) => { e.stopPropagation(); fetchWeather(); }}
              title="获取天气"
            >
              <span className="text-[14px] opacity-40">🌤️</span>
            </button>
          ) : null}

          {collapsed
            ? <ChevronDown size={16} strokeWidth={1.5} className="text-subtle" />
            : <ChevronUp size={16} strokeWidth={1.5} className="text-subtle" />
          }
        </div>
      </button>

      {/* Places list */}
      {!collapsed && (
        <div className="flex flex-col ml-2">
          {day.places.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-2xl glass-card" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <span className="text-3xl mb-2">🗺️</span>
              <span className="text-[13px] text-muted">还没有地点，点击 + 添加</span>
            </div>
          ) : (
            day.places.map((place, i) => {
              const nextPlace = day.places[i + 1];
              const segment = nextPlace
                ? day.transportBetween.find((s) => s.fromPlaceId === place.placeId && s.toPlaceId === nextPlace.placeId)
                : undefined;
              return (
                <div key={place.id}>
                  <PlaceCard
                    place={place}
                    index={i}
                    dayNumber={dayIndex + 1}
                    onDelete={() => onPlaceDelete(place.id)}
                    onPress={() => onPlacePress(place)}
                    onDurationChange={(m) => onPlaceDurationChange(place.id, m)}
                  />
                  {nextPlace && (
                    <RouteConnector
                      from={place}
                      to={nextPlace}
                      amapApiKey={config.amapApiKey}
                      planned={segment}
                    />
                  )}
                </div>
              );
            })
          )}

          <button
            className="tap flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed mt-2"
            style={{ borderColor: 'var(--color-divider)' }}
            onClick={onAddPlace}
          >
            <Plus size={14} strokeWidth={2} className="text-primary" />
            <span className="text-[13px] font-medium text-primary">添加地点</span>
          </button>

          {/* ── Tonight's hotel ─────────────────────────────────────── */}
          {!isLastDay && (onAddHotel || currentHotel) && (
            <div className="mt-3">
              {currentHotel ? (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'rgba(107,127,168,0.1)', border: '1px solid rgba(107,127,168,0.25)' }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-lg text-[14px]"
                    style={{ background: 'linear-gradient(135deg,#6B7FA8,#4A6080)' }}
                  >
                    🏨
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-muted leading-tight mb-0.5">今晚入住</div>
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{currentHotel.name}</div>
                    {currentHotel.address && (
                      <div className="text-[11px] text-muted truncate">{currentHotel.address}</div>
                    )}
                  </div>
                  {onRemoveHotel && (
                    <button
                      className="tap w-6 h-6 flex items-center justify-center flex-shrink-0 rounded-full"
                      style={{ backgroundColor: 'rgba(200,90,62,0.08)' }}
                      onClick={() => onRemoveHotel(currentHotel.id)}
                      title="移除今晚的酒店"
                    >
                      <Trash2 size={11} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
                    </button>
                  )}
                </div>
              ) : addingHotel ? (
                <div
                  className="rounded-xl p-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid var(--color-divider)' }}
                >
                  <div className="text-[11px] text-muted mb-2">
                    第 {dayIndex + 1} 晚 · {day.date} 入住 / {defaultCheckOut} 退房
                  </div>
                  <input
                    value={hotelForm.name}
                    onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                    placeholder="酒店名 *"
                    className="w-full px-2.5 py-2 rounded-lg outline-none mb-2"
                    style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                  />
                  <input
                    value={hotelForm.address}
                    onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                    placeholder="地址（可选，用于地图显示）"
                    className="w-full px-2.5 py-2 rounded-lg outline-none mb-2"
                    style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                  />
                  <input
                    value={hotelForm.notes}
                    onChange={(e) => setHotelForm({ ...hotelForm, notes: e.target.value })}
                    placeholder="备注（可选）"
                    className="w-full px-2.5 py-2 rounded-lg outline-none mb-2"
                    style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                  />
                  <div className="flex gap-2">
                    <button
                      className="tap flex-1 py-2 rounded-lg text-[12px]"
                      style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)' }}
                      onClick={() => { setAddingHotel(false); setHotelForm({ name: '', address: '', notes: '' }); }}
                      disabled={hotelSubmitting}
                    >
                      取消
                    </button>
                    <button
                      className="tap flex-1 py-2 rounded-lg text-[12px] font-semibold text-white"
                      style={{ backgroundColor: hotelSubmitting ? 'var(--color-text-tertiary)' : 'var(--color-primary)' }}
                      disabled={hotelSubmitting || !hotelForm.name.trim() || !onAddHotel}
                      onClick={async () => {
                        if (!onAddHotel) return;
                        setHotelSubmitting(true);
                        let location = { lat: 0, lng: 0 };
                        if (hotelForm.address.trim() && config.amapApiKey) {
                          const coords = await geocode(config.amapApiKey, hotelForm.address.trim());
                          if (coords) location = coords;
                        }
                        const hotel: Hotel = {
                          id: nanoid(),
                          name: hotelForm.name.trim(),
                          location,
                          address: hotelForm.address.trim() || undefined,
                          checkInDate: day.date,
                          checkOutDate: defaultCheckOut,
                          notes: hotelForm.notes.trim() || undefined,
                        };
                        onAddHotel(hotel);
                        setHotelForm({ name: '', address: '', notes: '' });
                        setAddingHotel(false);
                        setHotelSubmitting(false);
                      }}
                    >
                      {hotelSubmitting ? '保存中…' : '保存酒店'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="tap w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-medium"
                  style={{
                    backgroundColor: 'rgba(107,127,168,0.08)',
                    color: '#6B7FA8',
                    border: '1px dashed rgba(107,127,168,0.35)',
                  }}
                  onClick={() => setAddingHotel(true)}
                >
                  <HotelIcon size={12} strokeWidth={1.5} />
                  添加第 {dayIndex + 1} 晚的酒店
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
