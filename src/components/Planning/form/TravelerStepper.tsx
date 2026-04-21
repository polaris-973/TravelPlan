import { Minus, Plus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}

export function TravelerStepper({ label, value, onChange, min = 0, max = 20 }: Props) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px]" style={{ color: 'var(--color-text)' }}>{label}</span>
      <div className="flex items-center gap-3">
        <button
          className="tap w-7 h-7 flex items-center justify-center rounded-full"
          style={{ backgroundColor: value > min ? 'var(--color-divider)' : 'rgba(0,0,0,0.04)' }}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus size={12} strokeWidth={2} style={{ color: 'var(--color-text-secondary)' }} />
        </button>
        <span className="text-[14px] font-semibold w-6 text-center" style={{ color: 'var(--color-text)' }}>{value}</span>
        <button
          className="tap w-7 h-7 flex items-center justify-center rounded-full"
          style={{ backgroundColor: value < max ? 'var(--color-primary)' : 'rgba(0,0,0,0.04)' }}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus size={12} strokeWidth={2} style={{ color: 'white' }} />
        </button>
      </div>
    </div>
  );
}
