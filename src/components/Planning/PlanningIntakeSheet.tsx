/**
 * 智能规划单页表单 + 生成 + 审阅
 * 单个组件内部用 step 状态机切换：intake → generating → review
 */
import { useState, useEffect } from 'react';
import { X, Sparkles, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePlanningStore } from '../../store/planningStore';
import { useTripStore } from '../../store/tripStore';
import { PlanningProgressLog } from './PlanningProgressLog';
import type {
  Trip, TripIntake, PlacePlanInput, Interest, TripPace, TransportMode, Budget, Airport,
} from '../../types/trip';

import { Section } from './form/Section';
import { ChoiceRow } from './form/ChoiceRow';
import { TravelerStepper } from './form/TravelerStepper';
import { InterestChips } from './form/InterestChips';
import { AirportPicker } from './form/AirportPicker';
import { PlaceEditorList } from './form/PlaceEditorList';
import { DayPlanCard } from './DayPlanCard';

interface Props {
  isOpen: boolean;
  trip: Trip;
  onClose: () => void;
}

function defaultIntake(trip: Trip): TripIntake {
  const now = new Date();
  const arrivalDate = trip.startDate
    ? `${trip.startDate}T10:00`
    : new Date(now.getTime() + 86400000 * 3).toISOString().slice(0, 16);
  const returnDate = trip.endDate
    ? `${trip.endDate}T18:00`
    : new Date(now.getTime() + 86400000 * 9).toISOString().slice(0, 16);

  return {
    arrivalAirport: { name: '' },
    arrivalDateTime: arrivalDate,
    returnDateTime: returnDate,
    adults: trip.travelers || 2,
    children: 0,
    elderly: 0,
    altitudeSensitive: trip.preferences?.avoidAltitude ?? false,
    interests: trip.preferences?.interests ?? [],
    budget: trip.preferences?.budget ?? 'mid',
    mustDoActivities: '',
    pace: trip.preferences?.pace ?? 'balanced',
    preferredTransport: 'driving',
    dailyStartTime: '09:00',
    dailyEndTime: '20:00',
    lunchDurationMinutes: 75,
    dinnerDurationMinutes: 75,
    avoidRainyOutdoor: true,
  };
}

type SheetStep = 'intake' | 'generating' | 'review';

export function PlanningIntakeSheet({ isOpen, trip, onClose }: Props) {
  const config = useSettingsStore((s) => s.config);
  const { isGenerating, progress, currentDraft, currentError, generatePlan, cancelGeneration, clearDraft } = usePlanningStore();
  const { savePlan } = useTripStore();

  const [step, setStep] = useState<SheetStep>('intake');
  const [intake, setIntake] = useState<TripIntake>(() => defaultIntake(trip));
  const [places, setPlaces] = useState<PlacePlanInput[]>([]);
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    if (isOpen && step === 'intake') {
      // Reset intake when opening fresh
      setIntake(defaultIntake(trip));
      setPlaces([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, trip.id]);

  // Transition to review when generation completes
  useEffect(() => {
    if (currentDraft && step === 'generating') {
      setPlanName(currentDraft.name);
      setStep('review');
    }
  }, [currentDraft, step]);

  if (!isOpen) return null;

  const patch = (p: Partial<TripIntake>) => setIntake((i) => ({ ...i, ...p }));

  const validation = (() => {
    const errors: string[] = [];
    if (!intake.arrivalAirport.name.trim()) errors.push('请选择到达机场');
    if (!intake.arrivalDateTime) errors.push('请填写到达时间');
    if (!intake.returnDateTime) errors.push('请填写返程时间');
    if (new Date(intake.returnDateTime) <= new Date(intake.arrivalDateTime)) errors.push('返程时间须晚于到达时间');
    if (places.length === 0) errors.push('至少选择 1 个景点');
    if (!config.llmKeys?.[config.activeLLMProvider ?? 'zhipu']) errors.push('请先在设置中配置 LLM API Key');
    if (!config.amapApiKey) errors.push('请先在设置中配置高德地图 API Key');
    return errors;
  })();

  const handleGenerate = async () => {
    if (validation.length > 0) return;
    setStep('generating');
    await generatePlan(trip, intake, places, config);
    // step updates via useEffect watching currentDraft
  };

  const handleCancel = () => {
    cancelGeneration();
    setStep('intake');
  };

  const handleSave = () => {
    if (!currentDraft) return;
    const toSave = { ...currentDraft, name: planName.trim() || currentDraft.name };
    savePlan(trip.id, toSave);
    clearDraft();
    setStep('intake');
    onClose();
  };

  const handleDiscard = () => {
    clearDraft();
    setStep('intake');
  };

  const handleClose = () => {
    if (isGenerating) return; // don't close while generating
    clearDraft();
    setStep('intake');
    onClose();
  };

  // ── Shared Header ─────────────────────────────────────────────────────────
  const header = (title: string) => (
    <div
      className="flex-shrink-0 flex items-center justify-between px-4 py-3"
      style={{ paddingTop: 'calc(var(--safe-top) + 12px)', borderBottom: '1px solid var(--color-divider)', background: 'rgba(255,255,255,0.4)' }}
    >
      <h2 className="text-[17px] font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <button
        className="tap w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-divider)', opacity: isGenerating ? 0.4 : 1 }}
        onClick={handleClose}
        disabled={isGenerating}
      >
        <X size={15} strokeWidth={2} style={{ color: 'var(--color-text-secondary)' }} />
      </button>
    </div>
  );

  // ── INTAKE STEP ───────────────────────────────────────────────────────────
  if (step === 'intake') {
    const interestSummary = intake.interests.length > 0
      ? `${intake.interests.length} 个方向`
      : undefined;

    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{
          zIndex: 200,
          backgroundColor: 'rgba(245,245,242,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {header('智能行程规划')}

        <div className="flex-1 overflow-y-auto scroll-ios px-4 py-3">
          <Section title="行程 & 航班" defaultOpen required summary={intake.arrivalAirport.name || undefined}>
            <AirportPicker value={intake.arrivalAirport} onChange={(a: Airport) => patch({ arrivalAirport: a })} />

            {/* datetime-local needs ~180px min; stack on narrow screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div style={{ minWidth: 0 }}>
                <div className="text-[12px] text-muted mb-1.5">到达时间 <span className="text-accent">*</span></div>
                <input
                  type="datetime-local"
                  value={intake.arrivalDateTime}
                  onChange={(e) => patch({ arrivalDateTime: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl outline-none"
                  style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="text-[12px] text-muted mb-1.5">返程时间 <span className="text-accent">*</span></div>
                <input
                  type="datetime-local"
                  value={intake.returnDateTime}
                  onChange={(e) => patch({ returnDateTime: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl outline-none"
                  style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                />
              </div>
            </div>

            <div className="mb-1">
              <div className="text-[12px] text-muted mb-1.5">偏好返程城市（可选）</div>
              <input
                value={intake.preferredReturnCity ?? ''}
                onChange={(e) => patch({ preferredReturnCity: e.target.value || undefined })}
                placeholder="如：昆明（不填则由 AI 推荐最近机场）"
                className="w-full px-2.5 py-2 rounded-xl text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
          </Section>

          <Section title="出行人员" defaultOpen summary={`${intake.adults + intake.children + intake.elderly} 人`}>
            <TravelerStepper label="成人" value={intake.adults} onChange={(n) => patch({ adults: n })} min={1} />
            <TravelerStepper label="儿童" value={intake.children} onChange={(n) => patch({ children: n })} />
            <TravelerStepper label="老人" value={intake.elderly} onChange={(n) => patch({ elderly: n })} />
            <label className="flex items-center justify-between py-2 mt-1">
              <span className="text-[13px]" style={{ color: 'var(--color-text)' }}>对高原反应敏感</span>
              <input
                type="checkbox"
                checked={intake.altitudeSensitive}
                onChange={(e) => patch({ altitudeSensitive: e.target.checked })}
                className="w-4 h-4"
              />
            </label>
            <div className="mt-2">
              <div className="text-[12px] text-muted mb-1.5">特殊场合（可选）</div>
              <input
                value={intake.specialOccasion ?? ''}
                onChange={(e) => patch({ specialOccasion: e.target.value || undefined })}
                placeholder="如：蜜月、生日、毕业旅行"
                className="w-full px-2.5 py-2 rounded-xl text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
          </Section>

          <Section title="必去景点" defaultOpen required summary={places.length > 0 ? `${places.length} 个景点` : undefined}>
            <PlaceEditorList trip={trip} places={places} onChange={setPlaces} />
          </Section>

          <Section title="兴趣与活动" summary={interestSummary}>
            <InterestChips value={intake.interests} onChange={(v: Interest[]) => patch({ interests: v })} />
            <div className="mb-3">
              <div className="text-[12px] text-muted mb-1.5">最想做的活动（自述）</div>
              <textarea
                value={intake.mustDoActivities}
                onChange={(e) => patch({ mustDoActivities: e.target.value })}
                placeholder="如：想骑马、泡温泉、看日出、吃米线"
                rows={3}
                className="w-full px-2.5 py-2 rounded-xl text-[12px] outline-none resize-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1.5">已游玩过的地方（避免重复推荐）</div>
              <textarea
                value={intake.priorVisits ?? ''}
                onChange={(e) => patch({ priorVisits: e.target.value || undefined })}
                placeholder="如：2023 年去过丽江古城、玉龙雪山"
                rows={2}
                className="w-full px-2.5 py-2 rounded-xl text-[12px] outline-none resize-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
          </Section>

          <Section title="偏好" summary={`${intake.pace === 'packed' ? '紧凑' : intake.pace === 'relaxed' ? '轻松' : '适中'}节奏`}>
            <ChoiceRow<TripPace>
              label="行程节奏"
              options={[
                { value: 'relaxed', label: '轻松', icon: '🧘' },
                { value: 'balanced', label: '适中', icon: '🚶' },
                { value: 'packed', label: '紧凑', icon: '⚡' },
              ]}
              value={intake.pace}
              onChange={(v) => patch({ pace: v })}
            />
            <ChoiceRow<TransportMode>
              label="首选交通"
              options={[
                { value: 'driving', label: '自驾', icon: '🚗' },
                { value: 'transit', label: '公交', icon: '🚌' },
                { value: 'walking', label: '步行', icon: '🚶' },
                { value: 'cycling', label: '骑行', icon: '🚴' },
              ]}
              value={intake.preferredTransport}
              onChange={(v) => patch({ preferredTransport: v })}
              columns={4}
            />
            <ChoiceRow<Budget>
              label="预算级别"
              options={[
                { value: 'budget', label: '经济', icon: '💰' },
                { value: 'mid', label: '中档', icon: '💳' },
                { value: 'luxury', label: '高端', icon: '💎' },
              ]}
              value={intake.budget}
              onChange={(v) => patch({ budget: v })}
            />

            <div className="grid grid-cols-2 gap-2 mb-3 mt-1">
              <div style={{ minWidth: 0 }}>
                <div className="text-[12px] text-muted mb-1.5">每日出发时间</div>
                <input
                  type="time"
                  value={intake.dailyStartTime}
                  onChange={(e) => patch({ dailyStartTime: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl outline-none"
                  style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="text-[12px] text-muted mb-1.5">每日结束时间</div>
                <input
                  type="time"
                  value={intake.dailyEndTime}
                  onChange={(e) => patch({ dailyEndTime: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl outline-none"
                  style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)', fontSize: 14, minWidth: 0 }}
                />
              </div>
            </div>

            <label className="flex items-center justify-between py-1">
              <span className="text-[13px]" style={{ color: 'var(--color-text)' }}>雨天改室内</span>
              <input
                type="checkbox"
                checked={intake.avoidRainyOutdoor}
                onChange={(e) => patch({ avoidRainyOutdoor: e.target.checked })}
                className="w-4 h-4"
              />
            </label>
          </Section>

          <Section title="其他（可选）">
            <div className="mb-3">
              <div className="text-[12px] text-muted mb-1.5">饮食偏好</div>
              <input
                value={intake.dietaryPrefs ?? ''}
                onChange={(e) => patch({ dietaryPrefs: e.target.value || undefined })}
                placeholder="如：素食、不吃辣、海鲜过敏"
                className="w-full px-2.5 py-2 rounded-xl text-[12px] outline-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
            <div>
              <div className="text-[12px] text-muted mb-1.5">其他备注</div>
              <textarea
                value={intake.additionalNotes ?? ''}
                onChange={(e) => patch({ additionalNotes: e.target.value || undefined })}
                placeholder="任何想让 AI 知道的信息…"
                rows={3}
                className="w-full px-2.5 py-2 rounded-xl text-[12px] outline-none resize-none"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
              />
            </div>
          </Section>

          <div className="h-20" />
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-4 py-3"
          style={{
            borderTop: '1px solid var(--color-divider)',
            paddingBottom: 'calc(var(--safe-bottom) + 12px)',
            background: 'rgba(255,255,255,0.3)',
          }}
        >
          {validation.length > 0 && (
            <div
              className="flex items-start gap-1.5 mb-2 px-3 py-2 rounded-xl text-[11px]"
              style={{ backgroundColor: 'rgba(200,90,62,0.08)', color: 'var(--color-accent)' }}
            >
              <AlertCircle size={12} strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{validation.join(' · ')}</div>
            </div>
          )}
          <button
            className="tap w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-semibold"
            style={{
              backgroundColor: validation.length === 0 ? 'var(--color-primary)' : 'var(--color-divider)',
              color: validation.length === 0 ? 'white' : 'var(--color-text-tertiary)',
            }}
            onClick={handleGenerate}
            disabled={validation.length > 0}
          >
            <Sparkles size={16} strokeWidth={1.5} />
            生成智能方案
          </button>
        </div>
      </div>
    );
  }

  // ── GENERATING STEP ───────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{
          zIndex: 200,
          backgroundColor: 'rgba(245,245,242,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {header('AI 正在规划…')}
        <PlanningProgressLog
          progressMessage={progress.message}
          toolCallCount={progress.toolCallCount}
          isGenerating={isGenerating}
          onCancel={handleCancel}
          onBackToForm={() => setStep('intake')}
          error={currentError}
        />
      </div>
    );
  }

  // ── REVIEW STEP ───────────────────────────────────────────────────────────
  if (step === 'review' && currentDraft) {
    const { smartPlan, recommendedReturnAirport } = currentDraft;

    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{
          zIndex: 200,
          backgroundColor: 'rgba(245,245,242,0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {header('AI 规划方案')}

        <div className="flex-1 overflow-y-auto scroll-ios px-4 py-3">
          {/* Plan name input */}
          <div className="mb-3">
            <div className="text-[11px] text-muted mb-1">方案名称</div>
            <input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-[13px] font-medium outline-none"
              style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
            />
          </div>

          {/* Overall notes */}
          {smartPlan.overallNotes && (
            <div
              className="mb-3 px-4 py-3 rounded-2xl text-[12px] leading-relaxed"
              style={{ backgroundColor: 'rgba(58,122,140,0.07)', color: 'var(--color-text-secondary)', borderLeft: '3px solid var(--color-primary)' }}
            >
              <div className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>总体说明</div>
              {smartPlan.overallNotes}
            </div>
          )}

          {/* Recommended return airport */}
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

          {/* Unscheduled places */}
          {smartPlan.unscheduledPlaces && smartPlan.unscheduledPlaces.length > 0 && (
            <div
              className="mb-3 px-4 py-3 rounded-2xl"
              style={{ backgroundColor: 'rgba(200,90,62,0.07)', border: '1px solid rgba(200,90,62,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle size={13} style={{ color: 'var(--color-accent)' }} strokeWidth={1.5} />
                <span className="text-[12px] font-semibold" style={{ color: 'var(--color-accent)' }}>
                  {smartPlan.unscheduledPlaces.length} 个景点时间不足
                </span>
              </div>
              {smartPlan.unscheduledPlaces.map((p) => (
                <div key={p.placeId} className="text-[11px] text-muted mt-1">
                  · {p.name}：{p.reason}
                </div>
              ))}
            </div>
          )}

          {/* Day plans */}
          {smartPlan.days.map((day, i) => (
            <DayPlanCard key={day.date} day={day} dayNumber={i + 1} />
          ))}
          <div className="h-4" />
        </div>

        {/* Footer actions */}
        <div
          className="flex-shrink-0 flex gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--color-divider)', paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
        >
          <button
            className="tap flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-[13px] font-medium"
            style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)', flex: '0 0 auto' }}
            onClick={handleDiscard}
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            重新填写
          </button>
          <button
            className="tap flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[14px] font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onClick={handleSave}
          >
            <Check size={16} strokeWidth={2} />
            保存并应用
          </button>
        </div>
      </div>
    );
  }

  return null;
}
