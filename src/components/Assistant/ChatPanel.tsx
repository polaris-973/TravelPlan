import { useState, useRef, useEffect } from 'react';
import { X, Send, Mic, RotateCcw, Check } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../store/chatStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTripStore } from '../../store/tripStore';

interface ChatPanelProps {
  onClose: () => void;
}

const QUICK_PROMPTS = [
  '推荐适合文艺青年的大理行程',
  '玉龙雪山需要注意什么',
  '帮我在丽江多加一天',
  '哪些景点需要提前预约',
];

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, isLoading, proposal, sendMessage, acceptProposal, rejectProposal, clearHistory } = useChatStore();
  const config = useSettingsStore((s) => s.config);
  const trip = useTripStore((s) => s.getActiveTrip());
  const tripId = trip?.id ?? '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text, config, trip);
  };

  const handleVoice = () => {
    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognition = w.SpeechRecognition as SpeechRecognitionConstructor
      || w.webkitSpeechRecognition as SpeechRecognitionConstructor;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.onresult = (ev: SpeechRecognitionEvent) => setInput(ev.results[0][0].transcript);
    recognition.start();
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isConfigured = !!(config.llmKeys?.[config.activeLLMProvider ?? 'zhipu']);

  return (
    <div className="flex flex-col h-full animate-slide-up" style={{ backgroundColor: 'rgba(245,245,242,0.88)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)', borderBottom: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.30)' }}>
        <div>
          <h2 className="text-[17px] font-semibold" style={{ color: 'var(--color-text)' }}>AI 旅行助手</h2>
          <p className="text-[12px] text-muted">由 {config.activeLLMProvider === 'zhipu' ? '智谱 AI' : config.activeLLMProvider === 'deepseek' ? 'DeepSeek' : 'Claude'} 提供</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="tap w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-divider)' }} onClick={clearHistory}>
            <RotateCcw size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <button className="tap w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-divider)' }} onClick={onClose}>
            <X size={16} strokeWidth={2} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-ios px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full pb-8">
            <div className="text-5xl mb-3">🤖</div>
            <h3 className="text-[17px] font-semibold mb-1" style={{ color: 'var(--color-text)' }}>你好，我是滇途助手</h3>
            <p className="text-[13px] text-muted text-center max-w-[240px] mb-6 leading-relaxed">
              我熟悉云南每一个角落，可以帮你规划行程、查询天气、推荐美食
            </p>
            {!isConfigured && (
              <div className="px-4 py-3 rounded-2xl mb-4 text-center" style={{ backgroundColor: 'rgba(200, 90, 62, 0.08)' }}>
                <p className="text-[13px] text-accent font-medium">请先在设置中配置 API Key</p>
              </div>
            )}
            <div className="w-full space-y-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  className="tap w-full text-left px-4 py-3 rounded-2xl glass-card text-[13px]"
                  style={{ color: 'var(--color-text)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
        <div ref={messagesEndRef} />
      </div>

      {/* Proposal preview */}
      {proposal && (
        <div className="mx-4 mb-3 p-4 rounded-2xl border-2" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'rgba(58, 122, 140, 0.06)' }}>
          <div className="text-[13px] font-semibold text-primary mb-1">行程变更预览</div>
          <div className="text-[13px] text-muted mb-3 leading-relaxed">{proposal.description}</div>
          <div className="flex gap-2">
            <button className="tap flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-primary" onClick={() => acceptProposal(tripId)}>
              <Check size={14} strokeWidth={2} /> 确认修改
            </button>
            <button className="tap flex-1 py-2.5 rounded-xl text-[13px] font-medium text-muted" style={{ backgroundColor: 'var(--color-divider)' }} onClick={rejectProposal}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-3 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)', borderTop: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.20)' }}>
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end glass-card rounded-2xl px-3 py-2 min-h-[44px]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问我任何关于云南旅行的问题…"
              disabled={isLoading || !isConfigured}
              className="flex-1 bg-transparent text-[14px] outline-none resize-none max-h-32 leading-relaxed"
              style={{ color: 'var(--color-text)', minHeight: 22 }}
              rows={1}
            />
          </div>
          <button className="tap w-10 h-10 flex items-center justify-center rounded-xl" onClick={handleVoice}>
            <Mic size={18} strokeWidth={1.5} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <button
            className={`tap w-10 h-10 flex items-center justify-center rounded-xl ${input.trim() && !isLoading ? 'bg-primary' : ''}`}
            style={{ backgroundColor: input.trim() && !isLoading ? 'var(--color-primary)' : 'var(--color-divider)' }}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white animate-spin-slow" />
            ) : (
              <Send size={16} strokeWidth={1.5} className={input.trim() ? 'text-white' : 'text-subtle'} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SpeechRecognitionEvent { results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { transcript: string; }
interface SpeechRecognitionConstructor { new(): SpeechRecognitionInstance; }
interface SpeechRecognitionInstance {
  lang: string;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
}
