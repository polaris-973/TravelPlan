/**
 * 只读方案预览 — 从分享链接 hash 解码后展示
 */
import { useMemo } from 'react';
import { MapPin, Users, Plane, Sparkles, Eye } from 'lucide-react';
import type { SharePayload } from '../../services/share';
import { DayPlanCard } from './DayPlanCard';

interface Props {
  payload: SharePayload;
  onExit: () => void;
}

const BUDGET_LABEL: Record<string, string> = {
  budget: '经济', mid: '中档', luxury: '高端',
};
const PACE_LABEL: Record<string, string> = {
  relaxed: '轻松', balanced: '适中', packed: '紧凑',
};

export function PlanViewer({ payload, onExit }: Props) {
  const { plan, tripTitle, sharedAt } = payload;
  const { intake, smartPlan, recommendedReturnAirport } = plan;

  const travelerSummary = useMemo(() => {
    const parts: string[] = [];
    if (intake.adults > 0) parts.push(`${intake.adults} 成人`);
    if (intake.children > 0) parts.push(`${intake.children} 儿童`);
    if (intake.elderly > 0) parts.push(`${intake.elderly} 老人`);
    return parts.join(' · ') || '未指定';
  }, [intake]);

  const totalStops = smartPlan.days.reduce(
    (n, d) => n + d.stops.filter((s) => s.type === 'place').length, 0,
  );

  const sharedLabel = new Date(sharedAt).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(180deg, rgba(245,245,242,1) 0%, rgba(235,240,238,1) 100%)',
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{
          paddingTop: 'calc(var(--safe-top) + 16px)',
          background: 'linear-gradient(180deg, rgba(58,122,140,0.18) 0%, rgba(58,122,140,0.02) 100%)',
          borderBottom: '1px solid rgba(58,122,140,0.15)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Eye size={13} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-primary)' }}>
            只读分享视图 · {sharedLabel}
          </span>
        </div>

        <div className="flex items-start gap-2 mb-3">
          <Sparkles size={18} strokeWidth={1.5} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
              {tripTitle}
            </h1>
            <div className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {plan.name}
            </div>
          </div>
        </div>

        {/* Intake summary pills */}
        <div className="flex flex-wrap gap-1.5">
          <Pill icon={<Plane size={11} />} text={`${intake.arrivalAirport.name || '机场'} ${intake.arrivalAirport.code ? `(${intake.arrivalAirport.code})` : ''}`} />
          <Pill icon={<Users size={11} />} text={travelerSummary} />
          <Pill text={`${PACE_LABEL[intake.pace] ?? intake.pace}节奏`} />
          <Pill text={`${BUDGET_LABEL[intake.budget] ?? intake.budget}预算`} />
          <Pill text={`${smartPlan.days.length} 天 · ${totalStops} 景点`} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 pb-24">
        {/* Overall notes */}
        {smartPlan.overallNotes && (
          <div
            className="mb-3 px-4 py-3 rounded-2xl text-[12px] leading-relaxed"
            style={{
              backgroundColor: 'rgba(58,122,140,0.07)',
              color: 'var(--color-text-secondary)',
              borderLeft: '3px solid var(--color-primary)',
            }}
          >
            <div className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>总体说明</div>
            {smartPlan.overallNotes}
          </div>
        )}

        {/* Return airport */}
        {recommendedReturnAirport && (
          <div
            className="mb-3 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: 'rgba(139,168,136,0.12)', border: '1px solid rgba(139,168,136,0.3)' }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[14px]">✈️</span>
              <span className="text-[12px] font-semibold" style={{ color: '#6B8068' }}>推荐返程机场</span>
            </div>
            <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>
              {recommendedReturnAirport.name}
              {recommendedReturnAirport.code && <span className="text-muted ml-1.5">({recommendedReturnAirport.code})</span>}
            </div>
            <div className="text-[11px] text-muted mb-1">
              {recommendedReturnAirport.city}
              {recommendedReturnAirport.distanceKm != null && <> · 距行程终点 {recommendedReturnAirport.distanceKm.toFixed(1)} km</>}
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {recommendedReturnAirport.reason}
            </div>
          </div>
        )}

        {/* Unscheduled */}
        {smartPlan.unscheduledPlaces && smartPlan.unscheduledPlaces.length > 0 && (
          <div
            className="mb-3 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: 'rgba(200,90,62,0.07)', border: '1px solid rgba(200,90,62,0.2)' }}
          >
            <div className="text-[12px] font-semibold mb-1" style={{ color: 'var(--color-accent)' }}>
              {smartPlan.unscheduledPlaces.length} 个景点未安排
            </div>
            {smartPlan.unscheduledPlaces.map((p) => (
              <div key={p.placeId} className="text-[11px] text-muted mt-1">
                · {p.name}：{p.reason}
              </div>
            ))}
          </div>
        )}

        {/* Days */}
        {smartPlan.days.map((day, i) => (
          <DayPlanCard key={day.date || i} day={day} dayNumber={i + 1} />
        ))}

        {/* Footer note */}
        <div className="mt-4 flex items-center justify-center gap-2 opacity-60">
          <MapPin size={11} strokeWidth={1.5} />
          <span className="text-[11px]">滇途 · AI 旅行规划</span>
        </div>
      </div>

      {/* Fixed exit button */}
      <button
        className="tap fixed bottom-6 right-6 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-semibold text-white"
        style={{
          backgroundColor: 'var(--color-primary)',
          boxShadow: '0 4px 16px rgba(58,122,140,0.35)',
          zIndex: 100,
        }}
        onClick={onExit}
      >
        返回我的行程
      </button>
    </div>
  );
}

function Pill({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
      style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: 'var(--color-text-secondary)' }}
    >
      {icon}
      {text}
    </span>
  );
}
