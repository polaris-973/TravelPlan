import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { PlaceCard } from '../PlaceCard/PlaceCard';
import { RouteConnector } from '../Route/RouteConnector';
import { getWeatherForDate } from '../../services/weather/openmeteo';
import { useSettingsStore } from '../../store/settingsStore';
import type { Day, PlaceVisit, WeatherInfo } from '../../types/trip';

interface DayScheduleProps {
  day: Day;
  dayIndex: number;
  onPlaceDelete: (placeId: string) => void;
  onPlacePress: (place: PlaceVisit) => void;
  onPlaceDurationChange: (placeId: string, minutes: number) => void;
  onAddPlace?: () => void;
  onWeatherFetched?: (weather: WeatherInfo) => void;
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
  day, dayIndex, onPlaceDelete, onPlacePress, onPlaceDurationChange, onAddPlace, onWeatherFetched,
}: DayScheduleProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const config = useSettingsStore((s) => s.config);

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
        </div>
      )}
    </div>
  );
}
