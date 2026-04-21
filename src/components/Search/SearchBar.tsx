import { useState, useRef, useCallback } from 'react';
import { Search, X, Mic, MapPin, AlertCircle } from 'lucide-react';
import { searchPOI, type PoiResult } from '../../services/amap/loader';
import { useSettingsStore } from '../../store/settingsStore';

interface SearchBarProps {
  onSelectPlace: (poi: PoiResult) => void;
  placeholder?: string;
}

export function SearchBar({ onSelectPlace, placeholder = '搜索地点' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PoiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const config = useSettingsStore((s) => s.config);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    if (!config.amapApiKey) {
      setResults([{ id: '__no_key__', name: '请先在设置中填写高德地图 API Key', address: '', location: { lng: 0, lat: 0 }, type: '', rating: 0 }]);
      return;
    }
    setLoading(true);
    try {
      const pois = await searchPOI(config.amapApiKey, q, '云南');
      setResults(pois.length > 0 ? pois : [{ id: '__empty__', name: `未找到"${q}"相关地点`, address: '换个关键词试试', location: { lng: 0, lat: 0 }, type: '', rating: 0 }]);
    } catch {
      setResults([{ id: '__err__', name: '搜索失败，请检查网络', address: '', location: { lng: 0, lat: 0 }, type: '', rating: 0 }]);
    } finally {
      setLoading(false);
    }
  }, [config.amapApiKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    if (val.length > 1) {
      timerRef.current = setTimeout(() => search(val), 400);
    } else {
      setResults([]);
    }
  };

  const handleVoice = () => {
    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognition = w.SpeechRecognition as SpeechRecognitionConstructor
      || w.webkitSpeechRecognition as SpeechRecognitionConstructor;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.onresult = (ev: SpeechRecognitionEvent) => {
      const text = ev.results[0][0].transcript;
      setQuery(text);
      search(text);
    };
    recognition.start();
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const clear = () => { setQuery(''); setResults([]); inputRef.current?.focus(); };

  const categoryLabel = (type: string) => {
    if (/景区|公园|山|湖/.test(type)) return '景点';
    if (/餐厅|美食|小吃/.test(type)) return '美食';
    if (/酒店|民宿/.test(type)) return '住宿';
    return '地点';
  };

  return (
    <div className="relative" style={{ zIndex: 20, minWidth: 0 }}>
      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 h-10 rounded-2xl glass-light"
        style={{ boxShadow: 'var(--shadow-md)', minWidth: 0 }}
      >
        {loading
          ? <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-primary animate-spin-slow flex-shrink-0" />
          : <Search size={15} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="bg-transparent outline-none placeholder-subtle"
          style={{ color: 'var(--color-text)', flex: '1 1 0%', minWidth: 0, fontSize: 15 }}
        />
        {query && (
          <button className="tap" onClick={clear}>
            <X size={14} strokeWidth={2} style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        )}
        <button className="tap ml-1" onClick={handleVoice}>
          <Mic size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
        </button>
      </div>

      {/* Results dropdown */}
      {focused && results.length > 0 && (
        <div
          className="absolute top-[calc(100%+8px)] left-0 right-0 bg-surface rounded-2xl overflow-hidden scroll-ios"
          style={{ boxShadow: 'var(--shadow-lg)', maxHeight: 320, overflowY: 'auto' }}
        >
          {results.map((poi, i) => {
            const isSystem = poi.id.startsWith('__');
            const isError = poi.id === '__err__' || poi.id === '__no_key__';
            return (
              <button
                key={poi.id}
                className="tap w-full flex items-start gap-3 px-4 py-3 text-left"
                style={{ borderBottom: i < results.length - 1 ? '1px solid var(--color-divider)' : undefined }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (isSystem) { onSelectPlace(poi); return; } // pass to parent for toast
                  onSelectPlace(poi);
                  setQuery(poi.name);
                  setResults([]);
                  if (navigator.vibrate) navigator.vibrate(10);
                }}
              >
                {isError
                  ? <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  : <MapPin size={14} strokeWidth={1.5} className="mt-0.5 flex-shrink-0 text-primary" />
                }
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium truncate" style={{ color: isError ? 'var(--color-accent)' : 'var(--color-text)' }}>{poi.name}</div>
                  {poi.address && <div className="text-[12px] truncate text-muted mt-0.5">{poi.address}</div>}
                </div>
                {!isSystem && <span className="pill badge-nature text-[11px] flex-shrink-0">{categoryLabel(poi.type)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Polyfill type for TS
interface SpeechRecognitionEvent { results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { transcript: string; }
interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance; }
interface SpeechRecognitionInstance {
  lang: string;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
}
