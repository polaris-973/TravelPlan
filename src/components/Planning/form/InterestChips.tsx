import type { Interest } from '../../../types/trip';

interface Chip {
  value: Interest;
  label: string;
  icon: string;
}

const CHIPS: Chip[] = [
  { value: 'nature', label: '自然', icon: '🏔️' },
  { value: 'culture', label: '人文', icon: '🏯' },
  { value: 'food', label: '美食', icon: '🍜' },
  { value: 'photography', label: '摄影', icon: '📷' },
  { value: 'adventure', label: '探险', icon: '🎒' },
];

interface Props {
  value: Interest[];
  onChange: (v: Interest[]) => void;
}

export function InterestChips({ value, onChange }: Props) {
  const toggle = (v: Interest) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div className="mb-3">
      <div className="text-[12px] text-muted mb-1.5">兴趣方向（可多选）</div>
      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map((c) => {
          const active = value.includes(c.value);
          return (
            <button
              key={c.value}
              className="tap px-3 py-1.5 rounded-full text-[12px] flex items-center gap-1"
              style={{
                backgroundColor: active ? 'rgba(58,122,140,0.14)' : 'var(--color-divider)',
                color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                border: active ? '1px solid rgba(58,122,140,0.3)' : '1px solid transparent',
              }}
              onClick={() => toggle(c.value)}
            >
              <span>{c.icon}</span>
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
