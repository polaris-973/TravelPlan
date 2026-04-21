import { useState, useRef } from 'react';
import { Trash2, Palette } from 'lucide-react';
import type { PlaceNote, NoteColor, NoteMood } from '../../types/trip';

const COLOR_CLASS: Record<NoteColor, string> = {
  yellow: 'glass-note-yellow',
  mint: 'glass-note-mint',
  peach: 'glass-note-peach',
  lavender: 'glass-note-lavender',
};

const COLOR_LABELS: { color: NoteColor; dot: string }[] = [
  { color: 'yellow', dot: '#F5D840' },
  { color: 'mint', dot: '#7DC89A' },
  { color: 'peach', dot: '#F5A070' },
  { color: 'lavender', dot: '#B8A0D8' },
];

const MOODS: NoteMood[] = ['😊', '🤩', '😌', '🤔', '😴'];

interface NoteCardProps {
  note: PlaceNote;
  onDelete: () => void;
  onUpdate: (patch: Partial<PlaceNote>) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function NoteCard({ note, onDelete, onUpdate }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [showActions, setShowActions] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 500);
  };
  const handlePointerUp = () => clearTimeout(longPressTimer.current);
  const handlePointerLeave = () => clearTimeout(longPressTimer.current);

  const saveEdit = () => {
    if (draft.trim()) onUpdate({ content: draft.trim() });
    setEditing(false);
  };

  return (
    <div
      className={`relative rounded-2xl p-3 ${COLOR_CLASS[note.color]} animate-fade-in-up`}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Action overlay */}
      {showActions && (
        <div
          className="absolute inset-0 rounded-2xl flex items-center justify-center gap-4 z-10"
          style={{ backgroundColor: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowActions(false)}
        >
          {/* Color picker */}
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {COLOR_LABELS.map(({ color, dot }) => (
              <button
                key={color}
                className="tap w-7 h-7 rounded-full border-2"
                style={{
                  backgroundColor: dot,
                  borderColor: note.color === color ? 'white' : 'transparent',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}
                onClick={() => { onUpdate({ color }); setShowActions(false); }}
              />
            ))}
          </div>
          {/* Delete */}
          <button
            className="tap w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(200,90,62,0.9)' }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 size={14} strokeWidth={2} className="text-white" />
          </button>
        </div>
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onClick={() => !showActions && !editing && setEditing(true)}
      >
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) saveEdit(); }}
            className="w-full bg-transparent text-[13px] outline-none resize-none leading-relaxed"
            style={{ color: 'var(--color-text)', minHeight: 56 }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
            {note.content}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
          {formatDate(note.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {note.mood && <span className="text-[14px]">{note.mood}</span>}
          {/* Mood picker */}
          <div className="flex gap-1">
            {MOODS.map((m) => (
              <button
                key={m}
                className="tap text-[13px] leading-none"
                style={{ opacity: note.mood === m ? 1 : 0.35 }}
                onClick={(e) => { e.stopPropagation(); onUpdate({ mood: note.mood === m ? undefined : m }); }}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            className="tap"
            onClick={(e) => { e.stopPropagation(); setShowActions(true); }}
          >
            <Palette size={12} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
