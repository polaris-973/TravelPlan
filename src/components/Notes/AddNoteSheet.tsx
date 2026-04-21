import { useState, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { NoteColor, NoteMood } from '../../types/trip';

const COLOR_OPTIONS: { color: NoteColor; dot: string; label: string }[] = [
  { color: 'yellow', dot: '#F5D840', label: '晴黄' },
  { color: 'mint', dot: '#7DC89A', label: '薄荷' },
  { color: 'peach', dot: '#F5A070', label: '蜜桃' },
  { color: 'lavender', dot: '#B8A0D8', label: '薰衣草' },
];

const MOODS: { emoji: NoteMood; label: string }[] = [
  { emoji: '😊', label: '开心' },
  { emoji: '🤩', label: '惊喜' },
  { emoji: '😌', label: '满足' },
  { emoji: '🤔', label: '思考' },
  { emoji: '😴', label: '疲惫' },
];

interface AddNoteSheetProps {
  onSave: (content: string, color: NoteColor, mood?: NoteMood) => void;
  onClose: () => void;
}

export function AddNoteSheet({ onSave, onClose }: AddNoteSheetProps) {
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('yellow');
  const [mood, setMood] = useState<NoteMood | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave(content.trim(), color, mood);
    onClose();
  };

  // Detect color class for the textarea background preview
  const colorClass: Record<NoteColor, string> = {
    yellow: 'glass-note-yellow',
    mint: 'glass-note-mint',
    peach: 'glass-note-peach',
    lavender: 'glass-note-lavender',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.40)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5 flex flex-col gap-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          paddingBottom: 'calc(var(--safe-bottom) + 20px)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          animation: 'slide-up 280ms var(--ease-ios)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold" style={{ color: 'var(--color-text)' }}>✏️ 添加旅行笔记</h3>
          <button className="tap w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-divider)' }} onClick={onClose}>
            <X size={14} strokeWidth={2} style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        </div>

        {/* Textarea with color preview */}
        <div className={`rounded-2xl p-3 ${colorClass[color]}`}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你的旅行感受…"
            className="w-full bg-transparent text-[14px] leading-relaxed outline-none resize-none"
            style={{ color: 'var(--color-text)', minHeight: 96 }}
          />
        </div>

        {/* Color selector */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted flex-shrink-0">便签颜色</span>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map(({ color: c, dot, label }) => (
              <button
                key={c}
                className="tap w-8 h-8 rounded-full border-2 relative"
                title={label}
                style={{
                  backgroundColor: dot,
                  borderColor: color === c ? 'var(--color-text)' : 'transparent',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
                onClick={() => setColor(c)}
              >
                {color === c && (
                  <Check size={12} strokeWidth={3} className="absolute inset-0 m-auto text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mood selector */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted flex-shrink-0">此刻心情</span>
          <div className="flex gap-2">
            {MOODS.map(({ emoji, label }) => (
              <button
                key={emoji}
                className="tap w-9 h-9 rounded-xl flex items-center justify-center text-[18px]"
                title={label}
                style={{
                  backgroundColor: mood === emoji ? 'var(--color-primary)' : 'var(--color-divider)',
                  transform: mood === emoji ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 150ms var(--ease-ios)',
                }}
                onClick={() => setMood(mood === emoji ? undefined : emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          className="tap w-full py-3 rounded-2xl text-[15px] font-semibold text-white flex items-center justify-center gap-2"
          style={{
            backgroundColor: content.trim() ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
            transition: 'background-color 150ms',
          }}
          onClick={handleSave}
          disabled={!content.trim()}
        >
          <Check size={16} strokeWidth={2.5} />
          保存笔记
        </button>
      </div>
    </div>
  );
}
