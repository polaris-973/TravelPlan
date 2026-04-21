import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Eye, EyeOff } from 'lucide-react';
import type { LLMProvider } from '../../types/llm';
import { PROVIDER_DEFAULTS } from '../../services/llm/factory';

interface LLMProviderCardProps {
  provider: LLMProvider;
  isActive: boolean;
  apiKey: string;
  model: string;
  onActivate: () => void;
  onKeyChange: (key: string) => void;
  onModelChange: (model: string) => void;
}

const PROVIDER_INFO = {
  zhipu: {
    name: '智谱 AI',
    description: '国内首选，新用户免费额度，¥0.05/千 tokens',
    tag: '推荐',
    tagColor: '#8BA888',
    emoji: '🤖',
    url: 'https://open.bigmodel.cn',
  },
  deepseek: {
    name: 'DeepSeek',
    description: '性价比最高，¥0.001/千 tokens',
    tag: '省钱',
    tagColor: '#3A7A8C',
    emoji: '🐋',
    url: 'https://platform.deepseek.com',
  },
  anthropic: {
    name: 'Claude',
    description: '能力最强，需要国际信用卡',
    tag: '强大',
    tagColor: '#D4A574',
    emoji: '✨',
    url: 'https://console.anthropic.com',
  },
};

export function LLMProviderCard({
  provider, isActive, apiKey, model,
  onActivate, onKeyChange, onModelChange,
}: LLMProviderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const info = PROVIDER_INFO[provider];
  const defaults = PROVIDER_DEFAULTS[provider];
  const configured = !!apiKey;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-card transition-all duration-200"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: isActive ? `2px solid var(--color-primary)` : `2px solid transparent`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="text-2xl">{info.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>{info.name}</span>
            <span className="pill text-[10px] font-medium" style={{ backgroundColor: `${info.tagColor}20`, color: info.tagColor }}>
              {info.tag}
            </span>
            {configured && <span className="pill text-[10px] badge-nature">已配置</span>}
          </div>
          <p className="text-[12px] text-muted mt-0.5">{info.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isActive && <Check size={16} strokeWidth={2} className="text-primary" />}
          <button className="tap" onClick={() => setExpanded(!expanded)}>
            {expanded
              ? <ChevronUp size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
              : <ChevronDown size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
            }
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--color-divider)' }}>
          <div className="pt-3 space-y-3">
            {/* API Key */}
            <div>
              <label className="text-[12px] font-medium text-muted block mb-1.5">API Key</label>
              <div className="flex items-center gap-2 px-3 h-10 rounded-xl" style={{ backgroundColor: 'var(--color-divider)' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => onKeyChange(e.target.value)}
                  placeholder={`填入 ${info.name} API Key`}
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: 'var(--color-text)' }}
                />
                <button className="tap" onClick={() => setShowKey(!showKey)}>
                  {showKey
                    ? <EyeOff size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
                    : <Eye size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
                  }
                </button>
              </div>
            </div>

            {/* Model selector */}
            <div>
              <label className="text-[12px] font-medium text-muted block mb-1.5">模型</label>
              <div className="flex flex-wrap gap-2">
                {defaults.models.map((m) => (
                  <button
                    key={m}
                    className="tap px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors"
                    style={{
                      backgroundColor: (model || defaults.model) === m ? 'var(--color-primary)' : 'var(--color-divider)',
                      color: (model || defaults.model) === m ? 'white' : 'var(--color-text-secondary)',
                    }}
                    onClick={() => onModelChange(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Activate + link */}
            <div className="flex items-center gap-3 pt-1">
              <button
                className="tap flex-1 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-colors"
                style={{ backgroundColor: isActive ? 'var(--color-primary-dark)' : 'var(--color-primary)' }}
                onClick={onActivate}
              >
                {isActive ? '当前使用中' : '切换到此提供商'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
