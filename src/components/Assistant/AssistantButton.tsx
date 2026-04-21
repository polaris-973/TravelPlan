import { useState, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatPanel } from './ChatPanel';

const DEFAULT_POS = { right: 20, bottom: 96 };
const FAB_SIZE = 52;

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function loadPos(): { right: number; bottom: number } {
  try {
    const raw = localStorage.getItem('fab_pos');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_POS;
}

function savePos(pos: { right: number; bottom: number }) {
  try { localStorage.setItem('fab_pos', JSON.stringify(pos)); } catch { /* ignore */ }
}

export function AssistantButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const [dragging, setDragging] = useState(false);

  const startPointer = useRef({ x: 0, y: 0 });
  const startPos = useRef(DEFAULT_POS);
  const hasMoved = useRef(false);

  const pointerActive = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startPointer.current = { x: e.clientX, y: e.clientY };
    startPos.current = pos;
    hasMoved.current = false;
    pointerActive.current = true;
    setDragging(false);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // iOS touch events don't set `e.buttons`, so gate on our own flag set in pointerdown.
    if (!pointerActive.current) return;
    const dx = e.clientX - startPointer.current.x;
    const dy = e.clientY - startPointer.current.y;
    if (!hasMoved.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    hasMoved.current = true;
    setDragging(true);

    // `right` grows as finger moves LEFT (dx < 0); `bottom` grows as finger moves UP (dy < 0)
    const newRight = clamp(startPos.current.right - dx, 8, window.innerWidth - FAB_SIZE - 8);
    const newBottom = clamp(startPos.current.bottom - dy, 8, window.innerHeight - FAB_SIZE - 8);
    setPos({ right: newRight, bottom: newBottom });
  }, []);

  const handlePointerUp = useCallback(() => {
    pointerActive.current = false;
    if (hasMoved.current) {
      savePos(pos);
    } else {
      setOpen(true);
      if (navigator.vibrate) navigator.vibrate(10);
    }
    setDragging(false);
  }, [pos]);

  const handlePointerCancel = useCallback(() => {
    pointerActive.current = false;
    setDragging(false);
  }, []);

  return (
    <>
      {!open && (
        <button
          className="fixed z-40 flex items-center justify-center rounded-full"
          style={{
            right: pos.right,
            bottom: `calc(var(--safe-bottom) + ${pos.bottom}px)`,
            width: FAB_SIZE,
            height: FAB_SIZE,
            background: 'rgba(255, 255, 255, 0.70)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.95)',
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            transition: dragging ? 'none' : 'box-shadow 200ms, transform 100ms',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <Sparkles
            size={22}
            strokeWidth={1.5}
            style={{
              color: 'var(--color-primary)',
              filter: 'drop-shadow(0 1px 2px rgba(58,122,140,0.25))',
            }}
          />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <ChatPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
