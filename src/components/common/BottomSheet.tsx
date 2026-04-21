import { useEffect, useRef, useState, useCallback } from 'react';

// ──────────────────────────────────────────────
// PersistentSheet — always visible, never hides.
// Snaps between peek / half / full via drag.
// ──────────────────────────────────────────────
interface PersistentSheetProps {
  /** Minimum always-visible height in px (peek strip). */
  peekHeight?: number;
  /** Additional snap points as fraction of window height (0–1). */
  snapPoints?: number[];
  /** Index into [peekHeight, ...snapPoints] to start at. 0 = peek. */
  defaultSnap?: number;
  children: (expanded: boolean) => React.ReactNode;
}

export function PersistentSheet({
  peekHeight = 76,
  snapPoints = [0.45, 0.92],
  defaultSnap = 0,
  children,
}: PersistentSheetProps) {
  const allSnaps = useCallback(() => {
    return [peekHeight, ...snapPoints.map((sp) => window.innerHeight * sp)];
  }, [peekHeight, snapPoints]);

  const [height, setHeight] = useState(() => {
    const snaps = [peekHeight, ...snapPoints.map((sp) => window.innerHeight * sp)];
    return snaps[defaultSnap] ?? peekHeight;
  });
  const [animating, setAnimating] = useState(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const isDragging = useRef(false);

  const snapTo = useCallback((targetH: number) => {
    setAnimating(true);
    setHeight(targetH);
    setTimeout(() => setAnimating(false), 300);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startH.current = height;
    isDragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dy = startY.current - e.touches[0].clientY;
    const newH = Math.max(peekHeight, Math.min(window.innerHeight * 0.96, startH.current + dy));
    setHeight(newH);
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    const snaps = allSnaps();
    const nearest = snaps.reduce((a, b) => Math.abs(a - height) < Math.abs(b - height) ? a : b);
    snapTo(nearest);
  };

  // Tap on handle when peeking → expand to first snap
  const handleTap = () => {
    const snaps = allSnaps();
    if (height <= peekHeight + 4) {
      snapTo(snaps[1] ?? snaps[0]);
    }
  };

  const expanded = height > peekHeight + 8;

  return (
    <div
      className="sheet-glass fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl flex flex-col"
      style={{
        height,
        boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
        transition: animating ? 'height 300ms var(--ease-ios)' : 'none',
        paddingBottom: 'var(--safe-bottom)',
        willChange: 'height',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex-shrink-0 flex items-center justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
        style={{ minHeight: 28 }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
      >
        <div
          className="rounded-full"
          style={{ width: 36, height: 4, backgroundColor: 'var(--color-text-tertiary)', opacity: 0.35 }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children(expanded)}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ModalSheet — closeable overlay with backdrop.
// Used for place detail and similar panels.
// ──────────────────────────────────────────────
interface ModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[];
  defaultSnap?: number;
}

export function ModalSheet({
  isOpen,
  onClose,
  children,
  snapPoints = [0.65, 0.95],
  defaultSnap = 0,
}: ModalSheetProps) {
  const [height, setHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const getSnapPx = useCallback((idx: number) => {
    const sp = snapPoints[idx] ?? snapPoints[0];
    return sp <= 1 ? window.innerHeight * sp : sp;
  }, [snapPoints]);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        setAnimating(true);
        setHeight(getSnapPx(defaultSnap));
        setTimeout(() => setAnimating(false), 320);
      });
    } else {
      setAnimating(true);
      setHeight(0);
      setTimeout(() => { setVisible(false); setAnimating(false); }, 320);
    }
  }, [isOpen, defaultSnap, getSnapPx]);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startH.current = height;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dy = startY.current - e.touches[0].clientY;
    const newH = Math.max(60, Math.min(window.innerHeight * 0.96, startH.current + dy));
    setHeight(newH);
  };

  const onTouchEnd = () => {
    const snaps = snapPoints.map((_, i) => getSnapPx(i));
    const minSnap = getSnapPx(0);
    if (height < minSnap * 0.6) {
      onClose();
      return;
    }
    const nearest = snaps.reduce((a, b) => Math.abs(a - height) < Math.abs(b - height) ? a : b);
    setAnimating(true);
    setHeight(nearest);
    setTimeout(() => setAnimating(false), 300);
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{ backgroundColor: `rgba(0,0,0,${isOpen ? 0.35 : 0})` }}
        onClick={onClose}
      />
      <div
        className="sheet-glass fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col overflow-hidden"
        style={{
          height,
          boxShadow: '0 -8px 48px rgba(0,0,0,0.15)',
          transition: animating ? 'height 320ms var(--ease-ios)' : 'none',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div
          className="flex-shrink-0 flex items-center justify-center pt-3 pb-1 cursor-grab"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'var(--color-text-tertiary)', opacity: 0.4 }} />
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}

// Keep old BottomSheet as alias of ModalSheet for backward compat
export { ModalSheet as BottomSheet };
