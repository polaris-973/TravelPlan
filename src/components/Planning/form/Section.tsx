import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  required?: boolean;
  children: ReactNode;
}

export function Section({ title, summary, defaultOpen = false, required, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="glass-card rounded-2xl mb-3 overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      <button
        className="tap w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>{title}</span>
          {required && <span className="text-[11px] text-accent">必填</span>}
          {!open && summary && (
            <span className="text-[11px] text-muted truncate ml-2">· {summary}</span>
          )}
        </div>
        {open
          ? <ChevronUp size={16} strokeWidth={1.5} className="text-subtle flex-shrink-0" />
          : <ChevronDown size={16} strokeWidth={1.5} className="text-subtle flex-shrink-0" />
        }
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
