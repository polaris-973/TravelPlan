import { useState } from 'react';
import { ChevronRight, Map, Bot, Sparkles } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useTripStore } from '../store/tripStore';

interface OnboardingPageProps {
  onComplete: () => void;
}

const STEPS = [
  {
    emoji: '🗺️',
    title: '地图驱动的行程规划',
    description: '在地图上自由添加、拖动景点，智能规划最优路线',
    icon: Map,
  },
  {
    emoji: '🤖',
    title: 'AI 助手全程陪伴',
    description: '用自然语言描述你的想法，助手帮你搞定一切',
    icon: Bot,
  },
  {
    emoji: '☁️',
    title: '云南专属深度攻略',
    description: '高反预警、少数民族礼仪、最佳摄影时机一网打尽',
    icon: Sparkles,
  },
];

const TEMPLATES = [
  { id: 'classic', title: '经典 7 日环线', desc: '昆明→大理→丽江→香格里拉', emoji: '🏔️', days: 7 },
  { id: 'south', title: '南线 5 日', desc: '昆明→西双版纳→建水', emoji: '🌴', days: 5 },
  { id: 'blank', title: '从空白开始', desc: '我有自己的想法', emoji: '✨', days: 7 },
];

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [step, setStep] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [amapKey, setAmapKey] = useState('');
  const [llmKey, setLlmKey] = useState('');
  const { setAmapConfig, setApiKey } = useSettingsStore();
  const { createTrip } = useTripStore();

  const isLastFeature = step === STEPS.length - 1;

  const handleSelectTemplate = (templateId: string) => {
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;

    if (amapKey) setAmapConfig('', amapKey);
    if (llmKey) setApiKey('zhipu', llmKey);

    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start.getTime() + 86400000 * (tmpl.days - 1));

    createTrip({
      title: tmpl.title,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
    onComplete();
  };

  if (showConfig) {
    return (
      <div className="flex flex-col h-full bg-app px-6 animate-fade-in-up" style={{ paddingTop: 'calc(var(--safe-top) + 40px)' }}>
        <h1 className="text-[28px] font-semibold mb-2" style={{ color: 'var(--color-text)' }}>快速配置</h1>
        <p className="text-[15px] text-muted mb-8 leading-relaxed">填入 API Key 即可开始使用，之后随时可以在设置中修改</p>

        <div className="space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-muted block mb-2">高德地图 API Key</label>
            <input
              type="password"
              value={amapKey}
              onChange={(e) => setAmapKey(e.target.value)}
              placeholder="必填，用于地图和路线规划"
              className="w-full px-4 h-12 rounded-2xl text-[15px] outline-none bg-surface shadow-card"
              style={{ color: 'var(--color-text)' }}
            />
            <p className="text-[11px] text-muted mt-1.5">前往 lbs.amap.com 免费申请</p>
          </div>

          <div>
            <label className="text-[13px] font-semibold text-muted block mb-2">智谱 AI API Key（可选）</label>
            <input
              type="password"
              value={llmKey}
              onChange={(e) => setLlmKey(e.target.value)}
              placeholder="用于 AI 助手，暂时跳过也可以"
              className="w-full px-4 h-12 rounded-2xl text-[15px] outline-none bg-surface shadow-card"
              style={{ color: 'var(--color-text)' }}
            />
            <p className="text-[11px] text-muted mt-1.5">前往 open.bigmodel.cn 申请，新用户有免费额度</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--color-text)' }}>选择行程模板</h3>
          <div className="space-y-3">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                className="tap w-full flex items-center gap-4 px-4 py-4 bg-surface rounded-2xl shadow-card text-left"
                onClick={() => handleSelectTemplate(tmpl.id)}
              >
                <span className="text-3xl">{tmpl.emoji}</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>{tmpl.title}</div>
                  <div className="text-[12px] text-muted">{tmpl.desc}</div>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
              </button>
            ))}
          </div>
        </div>

        <button className="tap mt-4 text-[13px] text-muted text-center py-2" onClick={onComplete}>
          跳过，直接进入
        </button>

        <div style={{ height: 'calc(var(--safe-bottom) + 20px)' }} />
      </div>
    );
  }

  const currentStep = STEPS[step];

  return (
    <div className="flex flex-col h-full bg-app" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      {/* Visual area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-float"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
        >
          <span className="text-5xl">{currentStep.emoji}</span>
        </div>

        <h2 className="text-[28px] font-semibold text-center mb-4 leading-tight" style={{ color: 'var(--color-text)' }}>
          {currentStep.title}
        </h2>
        <p className="text-[16px] text-center leading-relaxed text-muted max-w-[280px]">
          {currentStep.description}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex justify-center gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 6,
              height: 6,
              backgroundColor: i === step ? 'var(--color-primary)' : 'var(--color-divider)',
            }}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <button
          className="tap w-full h-14 rounded-2xl text-[17px] font-semibold text-white flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--color-primary)', boxShadow: 'var(--shadow-float)' }}
          onClick={() => {
            if (isLastFeature) setShowConfig(true);
            else setStep(step + 1);
          }}
        >
          {isLastFeature ? '开始规划' : '下一步'}
          <ChevronRight size={18} strokeWidth={2} />
        </button>

        {!isLastFeature && (
          <button className="tap w-full mt-3 py-2 text-[14px] text-muted text-center" onClick={() => setShowConfig(true)}>
            跳过引导
          </button>
        )}
      </div>
    </div>
  );
}
