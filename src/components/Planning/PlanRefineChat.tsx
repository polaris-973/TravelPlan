/**
 * 方案对话式调整
 * 基于已有 SavedPlan，通过自然语言让 LLM 修订方案。
 */
import { useState } from 'react';
import { X, Send, Sparkles, Check, RotateCcw, AlertCircle } from 'lucide-react';
import type { Trip, SavedPlan } from '../../types/trip';
import { usePlanningStore } from '../../store/planningStore';
import { useTripStore } from '../../store/tripStore';
import { useSettingsStore } from '../../store/settingsStore';
import { DayPlanCard } from './DayPlanCard';

interface Props {
  isOpen: boolean;
  trip: Trip;
  basePlan: SavedPlan;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  '把第 2 天改成室内活动为主',
  '太紧凑了，给第 3 天减两个景点',
  '我想第 4 天加一次骑马体验',
  '返程改成从大理出发',
];

export function PlanRefineChat({ isOpen, trip, basePlan, onClose }: Props) {
  const config = useSettingsStore((s) => s.config);
  const { isGenerating, progress, currentDraft, currentError, refinePlan, cancelGeneration, clearDraft } = usePlanningStore();
  const { savePlan, setActivePlan, deletePlan } = useTripStore();

  const [userInput, setUserInput] = useState('');

  if (!isOpen) return null;

  const canSend = !isGenerating && userInput.trim().length > 0
    && !!config.llmKeys?.[config.activeLLMProvider ?? 'zhipu']
    && !!config.amapApiKey;

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text || !canSend) return;
    setUserInput('');
    await refinePlan(trip, basePlan, text, config);
  };

  const handleSaveAsNew = () => {
    if (!currentDraft) return;
    savePlan(trip.id, currentDraft);
    clearDraft();
    onClose();
  };

  const handleOverwrite = () => {
    if (!currentDraft) return;
    // Save the revised plan, then delete the base plan so active is the new one
    savePlan(trip.id, currentDraft);
    setActivePlan(trip.id, currentDraft.id);
    deletePlan(trip.id, basePlan.id);
    clearDraft();
    onClose();
  };

  const handleDiscard = () => {
    clearDraft();
  };

  const handleClose = () => {
    if (isGenerating) return;
    clearDraft();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 210,
        backgroundColor: 'rgba(245,245,242,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)', borderBottom: '1px solid var(--color-divider)' }}
      >
        <div>
          <h2 className="text-[17px] font-semibold" style={{ color: 'var(--color-text)' }}>AI 调整方案</h2>
          <p className="text-[11px] text-muted">基于：{basePlan.name}</p>
        </div>
        <button
          className="tap w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-divider)', opacity: isGenerating ? 0.4 : 1 }}
          onClick={handleClose}
          disabled={isGenerating}
        >
          <X size={15} strokeWidth={2} style={{ color: 'var(--color-text-secondary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios px-4 py-3">
        {/* Draft result */}
        {currentDraft && (
          <div className="mb-3">
            <div
              className="mb-3 px-3 py-2 rounded-xl"
              style={{ backgroundColor: 'rgba(139,168,136,0.15)', border: '1px solid rgba(139,168,136,0.3)' }}
            >
              <div className="flex items-center gap-1.5">
                <Check size={13} strokeWidth={2.5} style={{ color: '#6B8068' }} />
                <span className="text-[12px] font-semibold" style={{ color: '#6B8068' }}>已生成调整版方案</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                共 {currentDraft.smartPlan.days.length} 天 · 审阅无误后可保存
              </div>
            </div>

            {currentDraft.smartPlan.overallNotes && (
              <div
                className="mb-3 px-3 py-2 rounded-xl text-[12px]"
                style={{ backgroundColor: 'rgba(58,122,140,0.07)', color: 'var(--color-text-secondary)', borderLeft: '3px solid var(--color-primary)' }}
              >
                {currentDraft.smartPlan.overallNotes}
              </div>
            )}

            {currentDraft.smartPlan.days.map((day, i) => (
              <DayPlanCard key={day.date} day={day} dayNumber={i + 1} />
            ))}

            <div className="flex gap-2 mt-3">
              <button
                className="tap flex-1 py-2.5 rounded-xl text-[12px] font-medium"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)' }}
                onClick={handleDiscard}
              >
                <RotateCcw size={12} strokeWidth={1.5} style={{ display: 'inline', marginRight: 4 }} />
                再改改
              </button>
              <button
                className="tap flex-1 py-2.5 rounded-xl text-[12px] font-medium"
                style={{ backgroundColor: 'rgba(58,122,140,0.1)', color: 'var(--color-primary)' }}
                onClick={handleSaveAsNew}
              >
                保存为新方案
              </button>
              <button
                className="tap flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
                onClick={handleOverwrite}
              >
                <Check size={12} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
                替换当前方案
              </button>
            </div>
          </div>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-xl"
            style={{ backgroundColor: 'rgba(58,122,140,0.08)' }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin-slow" style={{ borderTopColor: 'var(--color-primary)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{progress.message || '处理中…'}</div>
              <div className="text-[11px] text-muted">已调用 {progress.toolCallCount} 次工具</div>
            </div>
            <button
              className="tap text-[11px] text-muted"
              onClick={cancelGeneration}
            >
              取消
            </button>
          </div>
        )}

        {/* Error */}
        {currentError && !isGenerating && (
          <div
            className="flex items-start gap-1.5 mt-2 px-3 py-2 rounded-xl text-[11px]"
            style={{ backgroundColor: 'rgba(200,90,62,0.08)', color: 'var(--color-accent)' }}
          >
            <AlertCircle size={12} strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
            <div>{currentError}</div>
          </div>
        )}

        {/* Empty state — show quick prompts */}
        {!currentDraft && !isGenerating && (
          <div className="mt-2">
            <div className="text-[12px] text-muted mb-2">告诉 AI 你想怎么改，例如：</div>
            <div className="flex flex-col gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  className="tap text-left px-3 py-2.5 rounded-xl text-[12px]"
                  style={{ backgroundColor: 'rgba(58,122,140,0.06)', color: 'var(--color-text)', border: '1px solid rgba(58,122,140,0.15)' }}
                  onClick={() => setUserInput(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--color-divider)', paddingBottom: 'calc(var(--safe-bottom) + 12px)', background: 'rgba(255,255,255,0.3)' }}
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end glass-card rounded-2xl px-3 py-2 min-h-[44px]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="说说你想调整的地方…"
              disabled={isGenerating}
              rows={1}
              className="flex-1 bg-transparent text-[13px] outline-none resize-none max-h-32 leading-relaxed"
              style={{ color: 'var(--color-text)', minHeight: 22 }}
            />
          </div>
          <button
            className="tap w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: canSend ? 'var(--color-primary)' : 'var(--color-divider)' }}
            onClick={handleSend}
            disabled={!canSend}
          >
            {isGenerating
              ? <Sparkles size={16} strokeWidth={1.5} className="text-white animate-pulse" />
              : <Send size={16} strokeWidth={1.5} className={canSend ? 'text-white' : 'text-subtle'} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
