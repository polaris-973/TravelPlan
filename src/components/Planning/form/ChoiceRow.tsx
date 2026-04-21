interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

interface Props<T extends string> {
  label: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}

export function ChoiceRow<T extends string>({ label, options, value, onChange, columns = 3 }: Props<T>) {
  return (
    <div className="mb-3">
      <div className="text-[12px] text-muted mb-1.5">{label}</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              className="tap py-2.5 rounded-xl text-[12px] font-medium flex items-center justify-center gap-1"
              style={{
                backgroundColor: active ? 'var(--color-primary)' : 'var(--color-divider)',
                color: active ? 'white' : 'var(--color-text-secondary)',
              }}
              onClick={() => onChange(opt.value)}
            >
              {opt.icon && <span>{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
