import { useEffect, useState } from 'react';
import { CheckCircle, X, AlertCircle, Info, RotateCcw } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'undo';

interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  undoLabel?: string;
  onUndo?: () => void;
  onDismiss: (id: string) => void;
  duration?: number;
}

export function Toast({ id, message, type = 'info', undoLabel = '撤销', onUndo, onDismiss, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const icons = {
    success: <CheckCircle size={16} strokeWidth={1.5} />,
    error: <AlertCircle size={16} strokeWidth={1.5} />,
    info: <Info size={16} strokeWidth={1.5} />,
    undo: <RotateCcw size={16} strokeWidth={1.5} />,
  };

  const colors = {
    success: 'text-[#5A8A56]',
    error: 'text-accent',
    info: 'text-primary',
    undo: 'text-primary',
  };

  return (
    <div
      className={`animate-toast flex items-center gap-3 px-4 py-3 rounded-2xl glass-light shadow-lg-app
        transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ minWidth: 220, maxWidth: 320 }}
    >
      <span className={colors[type]}>{icons[type]}</span>
      <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--color-text)' }}>{message}</span>
      {onUndo && (
        <button
          className="tap text-[13px] font-semibold text-primary ml-1"
          onClick={() => { onUndo(); onDismiss(id); }}
        >
          {undoLabel}
        </button>
      )}
      <button className="tap" onClick={() => { setVisible(false); setTimeout(() => onDismiss(id), 300); }}>
        <X size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
      </button>
    </div>
  );
}

interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  onUndo?: () => void;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none"
      style={{ top: `calc(var(--safe-top) + 16px)` }}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast
            id={t.id}
            message={t.message}
            type={t.type}
            onUndo={t.onUndo}
            onDismiss={onDismiss}
            duration={t.duration}
          />
        </div>
      ))}
    </div>
  );
}

// Simple hook
import { useState as useToastState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useToastState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info', onUndo?: () => void, duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, onUndo, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}
