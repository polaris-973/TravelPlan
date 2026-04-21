import { useState, useEffect, useRef } from 'react';
import { Plane, Check } from 'lucide-react';
import { searchPOI } from '../../../services/amap/loader';
import type { Airport } from '../../../types/trip';
import { useSettingsStore } from '../../../store/settingsStore';

// Common Yunnan airports as quick picks
const PRESETS: Airport[] = [
  { name: '昆明长水国际机场', code: 'KMG', city: '昆明', location: { lng: 102.9292, lat: 25.1019 } },
  { name: '丽江三义国际机场', code: 'LJG', city: '丽江', location: { lng: 100.2440, lat: 26.6801 } },
  { name: '大理荒草坝机场', code: 'DLU', city: '大理', location: { lng: 100.3193, lat: 25.6494 } },
  { name: '西双版纳嘎洒国际机场', code: 'JHG', city: '西双版纳', location: { lng: 100.7600, lat: 21.9740 } },
  { name: '香格里拉迪庆机场', code: 'DIG', city: '香格里拉', location: { lng: 99.6072, lat: 27.7836 } },
  { name: '腾冲驼峰机场', code: 'TCZ', city: '腾冲', location: { lng: 98.4894, lat: 24.9381 } },
];

interface Props {
  value: Airport;
  onChange: (airport: Airport) => void;
}

export function AirportPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value.name);
  const [results, setResults] = useState<Airport[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiKey = useSettingsStore((s) => s.config.amapApiKey);

  useEffect(() => {
    setQuery(value.name);
  }, [value.name]);

  const runSearch = async (q: string) => {
    if (!q.trim() || !apiKey) { setResults([]); return; }
    setSearching(true);
    const pois = await searchPOI(apiKey, q, '云南');
    const airports: Airport[] = pois
      .filter((p) => /机场|airport/i.test(p.name) || /机场/.test(p.type))
      .slice(0, 6)
      .map((p) => ({
        name: p.name,
        city: p.address?.split(/[市州县]/)[0] || undefined,
        location: p.location,
      }));
    setResults(airports);
    setSearching(false);
  };

  const onInputChange = (v: string) => {
    setQuery(v);
    setShowSuggest(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 350);
  };

  const pick = (a: Airport) => {
    onChange(a);
    setQuery(a.name);
    setShowSuggest(false);
  };

  const isPicked = (a: Airport) => value.name === a.name;

  return (
    <div className="mb-3">
      <div className="text-[12px] text-muted mb-1.5">到达机场 <span className="text-accent">*</span></div>

      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--color-divider)' }}>
          <Plane size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={query}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
            placeholder="机场名称 / 城市"
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--color-text)' }}
          />
          {searching && <div className="w-3 h-3 rounded-full border-2 border-transparent border-t-primary animate-spin-slow" />}
        </div>

        {showSuggest && results.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10 glass-card"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
          >
            {results.map((a) => (
              <button
                key={`${a.name}-${a.location?.lng ?? 0}`}
                className="tap w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/40"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a)}
              >
                <span className="text-[13px] truncate" style={{ color: 'var(--color-text)' }}>{a.name}</span>
                {a.city && <span className="text-[11px] text-muted ml-2">{a.city}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="text-[11px] text-muted mb-1">常用机场</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((a) => {
            const picked = isPicked(a);
            return (
              <button
                key={a.code}
                className="tap px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1"
                style={{
                  backgroundColor: picked ? 'rgba(58,122,140,0.14)' : 'var(--color-divider)',
                  color: picked ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  border: picked ? '1px solid rgba(58,122,140,0.3)' : '1px solid transparent',
                }}
                onClick={() => pick(a)}
              >
                {picked && <Check size={9} strokeWidth={2.5} />}
                {a.code} · {a.city}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
