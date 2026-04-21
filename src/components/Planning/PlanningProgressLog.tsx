/**
 * Live planning progress log — shows each LLM step to the user in real-time.
 *
 * The user doesn't care about token counts; they care about:
 *   - is the AI actually doing something?
 *   - what is it doing right now?
 *   - did anything fail? what failed?
 *   - approximately how long will this take?
 */
import { useEffect, useRef } from 'react';
import { Sparkles, Map, CloudSun, Search, Route, MessageSquare, CheckCircle2, AlertTriangle, Info, Zap } from 'lucide-react';
import { usePlanningStore, type PlanEvent } from '../../store/planningStore';

interface Props {
  progressMessage: string;
  toolCallCount: number;
  isGenerating: boolean;
  error?: string | null;
  onCancel: () => void;
  onBackToForm?: () => void;
}

const TOOL_ICON_COLOR: Record<string, { icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>; color: string; bg: string; label: string }> = {
  amap_route_matrix:  { icon: Route,     color: '#3A7A8C', bg: 'rgba(58,122,140,0.12)',  label: '交通矩阵' },
  amap_get_weather:   { icon: CloudSun,  color: '#D4A574', bg: 'rgba(212,165,116,0.15)', label: '天气预报' },
  amap_search_poi:    { icon: Search,    color: '#6B7FA8', bg: 'rgba(107,127,168,0.15)', label: 'POI 搜索' },
  amap_geocode:       { icon: Map,       color: '#8BA888', bg: 'rgba(139,168,136,0.15)', label: '坐标解析' },
  amap_place_detail:  { icon: Info,      color: '#8E7DBE', bg: 'rgba(142,125,190,0.15)', label: '景点详情' },
  web_search:         { icon: Search,    color: '#A1A1A6', bg: 'rgba(161,161,166,0.12)', label: '网页搜索' },
  propose_smart_plan: { icon: CheckCircle2, color: '#6B8068', bg: 'rgba(139,168,136,0.22)', label: '生成方案' },
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function EventRow({ ev }: { ev: PlanEvent }) {
  const timestamp = formatTime(ev.at);

  if (ev.kind === 'info') {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          <Zap size={11} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{ev.text}</div>
          <div className="text-[10px] text-muted mt-0.5">{timestamp}</div>
        </div>
      </div>
    );
  }

  if (ev.kind === 'error') {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          <AlertTriangle size={11} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
        </div>
        <div
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg"
          style={{ backgroundColor: 'rgba(200,90,62,0.08)' }}
        >
          <div className="text-[12px]" style={{ color: 'var(--color-accent)' }}>{ev.text}</div>
          <div className="text-[10px] text-muted mt-0.5">{timestamp}</div>
        </div>
      </div>
    );
  }

  if (ev.kind === 'text') {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
          <MessageSquare size={11} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg"
          style={{ backgroundColor: 'rgba(58,122,140,0.06)', borderLeft: '2px solid var(--color-primary)' }}
        >
          <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
            {ev.text}
          </div>
          <div className="text-[10px] text-muted mt-1">{timestamp} · AI 思考</div>
        </div>
      </div>
    );
  }

  // tool_start / tool_end / tool_error
  const meta = ev.toolName ? TOOL_ICON_COLOR[ev.toolName] : undefined;
  const Icon = meta?.icon ?? Info;
  const color = meta?.color ?? 'var(--color-text-tertiary)';
  const bg = meta?.bg ?? 'var(--color-divider)';
  const label = meta?.label ?? ev.toolName ?? 'tool';

  if (ev.kind === 'tool_start') {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <div
          className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5 relative"
          style={{ backgroundColor: bg }}
        >
          <Icon size={11} strokeWidth={1.5} style={{ color }} />
          <div
            className="absolute -right-0.5 -bottom-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
            <span className="text-[10px] text-muted">进行中…</span>
          </div>
          {ev.argsSummary && (
            <div className="text-[11px] text-muted truncate mt-0.5" title={ev.argsSummary}>
              {ev.argsSummary}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (ev.kind === 'tool_error') {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <div
          className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
          style={{ backgroundColor: 'rgba(200,90,62,0.12)' }}
        >
          <AlertTriangle size={11} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--color-accent)' }}>{label}</span>
            <span className="text-[10px] text-muted">失败 {formatDuration(ev.durationMs)}</span>
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-accent)' }}>
            {ev.text}
          </div>
        </div>
      </div>
    );
  }

  // tool_end
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div
        className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
        style={{ backgroundColor: bg }}
      >
        <Icon size={11} strokeWidth={1.5} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
          <CheckCircle2 size={10} strokeWidth={2} style={{ color: '#6B8068' }} />
          <span className="text-[10px] text-muted">{formatDuration(ev.durationMs)}</span>
        </div>
        {ev.resultSummary && (
          <div className="text-[11px] text-muted mt-0.5 truncate" title={ev.resultSummary}>
            {ev.resultSummary}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanningProgressLog({
  progressMessage, toolCallCount, isGenerating, error, onCancel, onBackToForm,
}: Props) {
  const events = usePlanningStore((s) => s.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when new events arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll if user is near the bottom (within 80px)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Status bar */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--color-divider)', background: 'rgba(255,255,255,0.5)' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center relative"
          style={{ background: 'linear-gradient(135deg,rgba(58,122,140,0.15),rgba(44,95,107,0.15))' }}
        >
          <Sparkles size={18} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
          {isGenerating && (
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent animate-spin-slow"
              style={{ borderTopColor: 'var(--color-primary)' }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            {error ? '规划失败' : progressMessage || 'AI 正在规划…'}
          </div>
          <div className="text-[11px] text-muted">
            已调用 {toolCallCount} 次工具 · {events.length} 条日志
          </div>
        </div>
      </div>

      {/* Events log */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-ios px-4 py-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {events.length === 0 ? (
          <div className="text-[12px] text-muted text-center py-6">
            正在建立连接…
          </div>
        ) : (
          <div>
            {events.map((ev) => (
              <EventRow key={ev.id} ev={ev} />
            ))}
          </div>
        )}
      </div>

      {/* Footer — cancel or back */}
      <div
        className="flex-shrink-0 px-4 py-3 flex gap-2"
        style={{
          borderTop: '1px solid var(--color-divider)',
          paddingBottom: 'calc(var(--safe-bottom) + 12px)',
          background: 'rgba(255,255,255,0.3)',
        }}
      >
        {isGenerating ? (
          <button
            className="tap flex-1 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)' }}
            onClick={onCancel}
          >
            取消生成
          </button>
        ) : (
          <button
            className="tap flex-1 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            onClick={onBackToForm}
          >
            {error ? '返回修改' : '关闭'}
          </button>
        )}
      </div>
    </div>
  );
}
