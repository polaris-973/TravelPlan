import { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Check, Trash2, Edit2, Sparkles, Share2, Copy } from 'lucide-react';
import type { Trip, SavedPlan } from '../../types/trip';
import { useTripStore } from '../../store/tripStore';
import { encodePlanForShare, buildShareUrl } from '../../services/share';

interface Props {
  trip: Trip;
  onCreateNew: () => void;
  onRefinePlan?: (plan: SavedPlan) => void;
}

export function PlanSelector({ trip, onCreateNew, onRefinePlan }: Props) {
  const { setActivePlan, renamePlan, deletePlan } = useTripStore();
  const [menuState, setMenuState] = useState<{ planId: string; top: number; right: number } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [shareState, setShareState] = useState<{ plan: SavedPlan; url: string | null; loading: boolean; copied: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const plans = trip.savedPlans ?? [];
  const activeId = trip.activePlanId;
  const menuPlanId = menuState?.planId ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuState(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const openMenu = (planId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuPlanId === planId) { setMenuState(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({
      planId,
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  if (plans.length === 0) return null;

  const handleRenameSubmit = () => {
    if (!renameTarget) return;
    const name = renameTarget.name.trim();
    if (name) renamePlan(trip.id, renameTarget.id, name);
    setRenameTarget(null);
  };

  const handleDelete = (planId: string) => {
    if (plans.length === 1) {
      // Last plan — confirm is implicit; delete still works but may leave trip blank
    }
    deletePlan(trip.id, planId);
    setMenuState(null);
  };

  const handleShare = async (p: SavedPlan) => {
    setMenuState(null);
    setShareState({ plan: p, url: null, loading: true, copied: false });
    try {
      const encoded = await encodePlanForShare(p, trip.title);
      const url = buildShareUrl(encoded);
      setShareState({ plan: p, url, loading: false, copied: false });
    } catch (err) {
      console.error('[share]', err);
      setShareState({ plan: p, url: null, loading: false, copied: false });
    }
  };

  const doCopy = async () => {
    if (!shareState?.url) return;
    try {
      await navigator.clipboard.writeText(shareState.url);
      setShareState({ ...shareState, copied: true });
      setTimeout(() => setShareState((s) => s ? { ...s, copied: false } : null), 1800);
    } catch {
      // ignore — fallback: user selects the URL text manually
    }
  };

  const doWebShare = async () => {
    if (!shareState?.url) return;
    if (typeof navigator.share !== 'function') {
      doCopy();
      return;
    }
    try {
      await navigator.share({
        title: `${trip.title} · ${shareState.plan.name}`,
        text: `查看我用 AI 规划的云南行程：${shareState.plan.name}`,
        url: shareState.url,
      });
    } catch {
      // user cancelled share — no-op
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-1.5 overflow-x-auto scroll-ios pb-1"
        style={{ paddingLeft: 0 }}
      >
        {plans.map((p) => {
          const active = p.id === activeId;
          return (
            <div
              key={p.id}
              className="relative flex-shrink-0 flex items-center"
              style={{
                borderRadius: 10,
                background: active
                  ? 'linear-gradient(135deg, rgba(58,122,140,0.85), rgba(44,95,107,0.85))'
                  : 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: active
                  ? '1px solid rgba(255,255,255,0.35)'
                  : '1px solid rgba(255,255,255,0.70)',
                boxShadow: active
                  ? '0 2px 8px rgba(58,122,140,0.30)'
                  : '0 2px 6px rgba(0,0,0,0.06)',
                color: active ? 'white' : 'var(--color-text)',
              }}
            >
              <button
                className="tap flex items-center gap-1"
                style={{
                  padding: '5px 4px 5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  color: 'inherit',
                }}
                onClick={() => !active && setActivePlan(trip.id, p.id)}
              >
                {active && <Check size={10} strokeWidth={2.5} />}
                <span>{p.name}</span>
              </button>
              <button
                className="tap flex items-center justify-center"
                style={{
                  padding: '5px 8px 5px 4px',
                  color: 'inherit',
                }}
                onClick={(e) => { e.stopPropagation(); openMenu(p.id, e); }}
                aria-label="方案菜单"
              >
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}

        <button
          className="tap flex-shrink-0 flex items-center gap-1"
          style={{
            padding: '5px 10px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px dashed rgba(58,122,140,0.35)',
            color: 'var(--color-primary)',
          }}
          onClick={onCreateNew}
        >
          <Plus size={12} strokeWidth={2} />新方案
        </button>
      </div>

      {/* Floating menu — fixed-positioned so it escapes the horizontal-scroll container */}
      {menuState && (() => {
        const p = plans.find((pl) => pl.id === menuState.planId);
        if (!p) return null;
        return (
          <div
            ref={menuRef}
            className="rounded-xl overflow-hidden"
            style={{
              position: 'fixed',
              top: menuState.top,
              right: menuState.right,
              zIndex: 1000,
              boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
              backgroundColor: 'white',
              minWidth: 140,
            }}
          >
            {onRefinePlan && (
              <button
                className="tap w-full flex items-center gap-2 px-3 py-2 text-[12px]"
                style={{ color: 'var(--color-primary)' }}
                onClick={() => { onRefinePlan(p); setMenuState(null); }}
              >
                <Sparkles size={11} strokeWidth={1.5} />AI 调整
              </button>
            )}
            <button
              className="tap w-full flex items-center gap-2 px-3 py-2 text-[12px]"
              style={{ color: 'var(--color-text)', borderTop: onRefinePlan ? '1px solid var(--color-divider)' : undefined }}
              onClick={() => handleShare(p)}
            >
              <Share2 size={11} strokeWidth={1.5} />分享方案
            </button>
            <button
              className="tap w-full flex items-center gap-2 px-3 py-2 text-[12px]"
              style={{ color: 'var(--color-text)', borderTop: '1px solid var(--color-divider)' }}
              onClick={() => { setRenameTarget({ id: p.id, name: p.name }); setMenuState(null); }}
            >
              <Edit2 size={11} strokeWidth={1.5} />重命名
            </button>
            <button
              className="tap w-full flex items-center gap-2 px-3 py-2 text-[12px]"
              style={{ color: 'var(--color-accent)', borderTop: '1px solid var(--color-divider)' }}
              onClick={() => handleDelete(p.id)}
            >
              <Trash2 size={11} strokeWidth={1.5} />删除方案
            </button>
          </div>
        );
      })()}

      {/* Share dialog */}
      {shareState && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShareState(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4"
            style={{ backgroundColor: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <Share2 size={14} strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
              <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>分享只读方案</div>
            </div>
            <div className="text-[11px] text-muted mb-3 leading-relaxed">
              发送下方链接给好友，对方会看到 <strong>{shareState.plan.name}</strong> 的只读版本（无法修改）。
              方案数据通过 URL 自带，无需联网同步。
            </div>

            {shareState.loading && (
              <div className="flex items-center gap-2 py-6 justify-center text-[12px] text-muted">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-primary animate-spin-slow" />
                正在生成链接…
              </div>
            )}

            {!shareState.loading && shareState.url && (
              <>
                <div
                  className="rounded-xl px-3 py-2 mb-3 max-h-24 overflow-y-auto"
                  style={{ backgroundColor: 'var(--color-divider)', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, wordBreak: 'break-all', color: 'var(--color-text-secondary)' }}
                >
                  {shareState.url}
                </div>

                <div className="flex gap-2">
                  <button
                    className="tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-medium"
                    style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
                    onClick={doCopy}
                  >
                    {shareState.copied
                      ? (<><Check size={12} strokeWidth={2} /> 已复制</>)
                      : (<><Copy size={12} strokeWidth={1.5} /> 复制链接</>)
                    }
                  </button>
                  {typeof navigator.share === 'function' && (
                    <button
                      className="tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      onClick={doWebShare}
                    >
                      <Share2 size={12} strokeWidth={1.5} /> 系统分享
                    </button>
                  )}
                </div>

                <div className="text-[10.5px] text-muted mt-2 text-center leading-relaxed">
                  💡 链接数据完全自包含 · 收件方浏览器打开即可 · 不会上传到任何服务器
                </div>
              </>
            )}

            {!shareState.loading && !shareState.url && (
              <div className="text-[12px] text-accent py-4 text-center">生成链接失败，请稍后重试</div>
            )}

            <button
              className="tap w-full mt-3 py-2 rounded-xl text-[12px]"
              style={{ backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
              onClick={() => setShareState(null)}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {renameTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4"
            style={{ backgroundColor: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text)' }}>重命名方案</div>
            <input
              value={renameTarget.name}
              onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-3"
              style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
            />
            <div className="flex gap-2">
              <button
                className="tap flex-1 py-2.5 rounded-xl text-[13px]"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text-secondary)' }}
                onClick={() => setRenameTarget(null)}
              >
                取消
              </button>
              <button
                className="tap flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
                onClick={handleRenameSubmit}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
