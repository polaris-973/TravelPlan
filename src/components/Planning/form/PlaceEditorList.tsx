import { useState, useRef } from 'react';
import { Trash2, Star, Import, ChevronDown, ChevronUp, Search, MapPin, Plus, X } from 'lucide-react';
import type { PlacePlanInput, PlaceIndoorType, Trip } from '../../../types/trip';
import { placeVisitToPlanInput } from '../../../store/planningStore';
import { searchPOI, type PoiResult } from '../../../services/amap/loader';
import { useSettingsStore } from '../../../store/settingsStore';
import { categoryFromType } from '../../../store/tripStore';

const PRIORITY_LABEL: Record<string, string> = { must: '必去', want: '想去', maybe: '备选' };
const PRIORITY_COLOR: Record<string, string> = {
  must: 'rgba(200,90,62,0.12)', want: 'rgba(139,168,136,0.12)', maybe: 'rgba(107,127,168,0.12)',
};
const PRIORITY_TEXT: Record<string, string> = {
  must: 'var(--color-accent)', want: '#8BA888', maybe: 'var(--color-primary)',
};

const DURATION_PRESETS = [60, 120, 180, 240, 360, 480, 600];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  if (minutes % 60 === 0) return `${minutes / 60}小时`;
  return `${Math.floor(minutes / 60)}h${minutes % 60}`;
}
const INDOOR_OPTIONS: Array<{ value: PlaceIndoorType; label: string; icon: string }> = [
  { value: 'outdoor', label: '户外', icon: '🌿' },
  { value: 'mixed', label: '混合', icon: '🏛️' },
  { value: 'indoor', label: '室内', icon: '🏠' },
];

interface Props {
  trip: Trip;
  places: PlacePlanInput[];
  onChange: (places: PlacePlanInput[]) => void;
}

function guessIndoor(category: string): PlaceIndoorType {
  if (['food', 'hotel', 'shopping'].includes(category)) return 'indoor';
  if (['nature'].includes(category)) return 'outdoor';
  if (['heritage', 'activity'].includes(category)) return 'mixed';
  return 'unknown';
}

export function PlaceEditorList({ trip, places, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PoiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiKey = useSettingsStore((s) => s.config.amapApiKey);

  const allTripPlaces = trip.days.flatMap((d) => d.places);
  const importedIds = new Set(places.map((p) => p.placeId));
  const canImport = allTripPlaces.some((p) => !importedIds.has(p.placeId));

  const runSearch = async (q: string) => {
    if (!q.trim() || !apiKey) { setResults([]); return; }
    setSearching(true);
    try {
      const pois = await searchPOI(apiKey, q, '云南');
      setResults(pois.slice(0, 10));
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (v: string) => {
    setQuery(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.trim().length > 1) {
      timerRef.current = setTimeout(() => runSearch(v), 350);
    } else {
      setResults([]);
    }
  };

  const addFromPoi = (poi: PoiResult) => {
    if (importedIds.has(poi.id)) {
      setQuery(''); setResults([]);
      return;
    }
    const category = categoryFromType(poi.type);
    const newPlace: PlacePlanInput = {
      placeId: poi.id,
      name: poi.name,
      location: poi.location,
      category,
      address: poi.address,
      indoorType: guessIndoor(category),
      activities: '',
      durationMinutes: 90,
      priority: 'want',
    };
    onChange([...places, newPlace]);
    setQuery(''); setResults([]);
    setExpandedId(newPlace.placeId);
  };

  const handleImport = () => {
    const add = allTripPlaces
      .filter((p) => !importedIds.has(p.placeId))
      .map(placeVisitToPlanInput);
    onChange([...places, ...add]);
  };

  const remove = (placeId: string) => {
    onChange(places.filter((p) => p.placeId !== placeId));
  };

  const update = (placeId: string, patch: Partial<PlacePlanInput>) => {
    onChange(places.map((p) => p.placeId === placeId ? { ...p, ...patch } : p));
  };

  const cyclePriority = (p: PlacePlanInput) => {
    const order: PlacePlanInput['priority'][] = ['must', 'want', 'maybe'];
    const next = order[(order.indexOf(p.priority) + 1) % 3];
    update(p.placeId, { priority: next });
  };

  return (
    <div>
      {/* Inline search to add places directly */}
      {searchOpen ? (
        <div
          className="rounded-xl p-2.5 mb-3"
          style={{ backgroundColor: 'rgba(58,122,140,0.06)', border: '1px solid rgba(58,122,140,0.2)' }}
        >
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'white' }}>
            {searching
              ? <div className="w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-primary animate-spin-slow" />
              : <Search size={13} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
            }
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="搜索云南的景点、美食等"
              className="flex-1 bg-transparent text-[12px] outline-none"
              style={{ color: 'var(--color-text)' }}
            />
            {query && (
              <button
                className="tap"
                onClick={() => { setQuery(''); setResults([]); }}
              >
                <X size={12} strokeWidth={2} style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            )}
            <button
              className="tap text-[11px] text-muted ml-1"
              onClick={() => { setSearchOpen(false); setQuery(''); setResults([]); }}
            >
              收起
            </button>
          </div>

          {!apiKey && query && (
            <div className="text-[11px] text-accent mt-1.5 px-1">请先在设置中配置高德地图 API Key</div>
          )}

          {results.length > 0 && (
            <div className="mt-1.5 rounded-lg overflow-hidden" style={{ backgroundColor: 'white' }}>
              {results.map((poi, i) => {
                const added = importedIds.has(poi.id);
                return (
                  <button
                    key={poi.id}
                    disabled={added}
                    className="tap w-full flex items-start gap-2 px-2.5 py-2 text-left"
                    style={{
                      borderBottom: i < results.length - 1 ? '1px solid var(--color-divider)' : undefined,
                      opacity: added ? 0.5 : 1,
                    }}
                    onClick={() => addFromPoi(poi)}
                  >
                    <MapPin size={12} strokeWidth={1.5} className="mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{poi.name}</div>
                      {poi.address && <div className="text-[10.5px] truncate text-muted mt-0.5">{poi.address}</div>}
                    </div>
                    <span className="text-[10px] text-muted flex-shrink-0">
                      {added ? '已添加' : '添加'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <button
            className="tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-medium"
            style={{
              backgroundColor: 'rgba(58,122,140,0.08)',
              color: 'var(--color-primary)',
              border: '1px dashed rgba(58,122,140,0.3)',
            }}
            onClick={() => setSearchOpen(true)}
          >
            <Plus size={12} strokeWidth={2} />
            搜索添加地点
          </button>
          {canImport && (
            <button
              className="tap flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-medium"
              style={{
                backgroundColor: 'rgba(139,168,136,0.1)',
                color: '#6B8068',
              }}
              onClick={handleImport}
            >
              <Import size={12} strokeWidth={1.5} />
              导入全部 ({allTripPlaces.length})
            </button>
          )}
        </div>
      )}

      {places.length === 0 ? (
        <div className="text-[12px] text-muted text-center py-6">
          未添加景点 · 点"搜索添加地点"直接添加，或导入已有行程中的地点
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {places.map((p) => {
            const isOpen = expandedId === p.placeId;
            return (
              <div
                key={p.placeId}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--color-divider)' }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => setExpandedId(isOpen ? null : p.placeId)}
                  >
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }}>{p.name}</div>
                    <div className="text-[11px] text-muted">{formatDuration(p.durationMinutes)} · {INDOOR_OPTIONS.find((o) => o.value === p.indoorType)?.label ?? '未知'}</div>
                  </button>

                  <button
                    className="tap px-2 py-0.5 rounded text-[11px] font-semibold flex-shrink-0"
                    style={{ backgroundColor: PRIORITY_COLOR[p.priority], color: PRIORITY_TEXT[p.priority] }}
                    onClick={() => cyclePriority(p)}
                  >
                    <Star size={9} strokeWidth={2} style={{ display: 'inline', marginRight: 2 }} />
                    {PRIORITY_LABEL[p.priority]}
                  </button>

                  <button
                    className="tap w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'rgba(200,90,62,0.08)' }}
                    onClick={() => remove(p.placeId)}
                  >
                    <Trash2 size={11} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
                  </button>

                  <button
                    className="tap w-6 h-6 flex items-center justify-center flex-shrink-0"
                    onClick={() => setExpandedId(isOpen ? null : p.placeId)}
                  >
                    {isOpen
                      ? <ChevronUp size={14} strokeWidth={1.5} className="text-subtle" />
                      : <ChevronDown size={14} strokeWidth={1.5} className="text-subtle" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 pt-0" style={{ borderTop: '1px solid var(--color-divider)' }}>
                    <div className="mt-2">
                      <div className="text-[11px] text-muted mb-1">室内/户外</div>
                      <div className="grid grid-cols-3 gap-1">
                        {INDOOR_OPTIONS.map((opt) => {
                          const active = opt.value === p.indoorType;
                          return (
                            <button
                              key={opt.value}
                              className="tap py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1"
                              style={{
                                backgroundColor: active ? 'var(--color-primary)' : 'var(--color-divider)',
                                color: active ? 'white' : 'var(--color-text-secondary)',
                              }}
                              onClick={() => update(p.placeId, { indoorType: opt.value })}
                            >
                              <span>{opt.icon}</span>{opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[11px] text-muted">游览时长</div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={5}
                            max={1440}
                            step={15}
                            value={p.durationMinutes}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!Number.isNaN(v) && v > 0) update(p.placeId, { durationMinutes: v });
                            }}
                            className="w-14 px-1.5 py-1 rounded-md text-[11px] text-center outline-none"
                            style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
                          />
                          <span className="text-[11px] text-muted">分钟</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {DURATION_PRESETS.map((d) => {
                          const active = d === p.durationMinutes;
                          return (
                            <button
                              key={d}
                              className="tap px-2.5 py-1 rounded-full text-[11px]"
                              style={{
                                backgroundColor: active ? 'var(--color-primary)' : 'var(--color-divider)',
                                color: active ? 'white' : 'var(--color-text-secondary)',
                              }}
                              onClick={() => update(p.placeId, { durationMinutes: d })}
                            >
                              {formatDuration(d)}
                            </button>
                          );
                        })}
                        <button
                          className="tap px-2.5 py-1 rounded-full text-[11px]"
                          style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)' }}
                          onClick={() => update(p.placeId, { durationMinutes: 720 })}
                          title="整天徒步"
                        >
                          整天
                        </button>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-[11px] text-muted mb-1">主要活动</div>
                      <textarea
                        value={p.activities}
                        onChange={(e) => update(p.placeId, { activities: e.target.value })}
                        placeholder="如：观日出、骑马、品尝当地小吃"
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none resize-none"
                        style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
                      />
                    </div>

                    <div className="mt-2">
                      <div className="text-[11px] text-muted mb-1">开放时间（若已知，可选）</div>
                      <input
                        value={p.openingHours ?? ''}
                        onChange={(e) => update(p.placeId, { openingHours: e.target.value || undefined })}
                        placeholder="如：08:00-18:00 或 全天"
                        className="w-full px-2.5 py-1.5 rounded-lg text-[12px] outline-none"
                        style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 text-[11px] text-muted text-center">
        共 {places.length} 个 · {places.filter((p) => p.priority === 'must').length} 个必去
      </div>
    </div>
  );
}
