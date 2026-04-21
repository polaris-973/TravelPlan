import { useRef, useState } from 'react';
import { ChevronLeft, Eye, EyeOff, Map, CloudSun, Navigation, Download, Upload, HardDrive } from 'lucide-react';
import { LLMProviderCard } from './LLMProviderCard';
import { useSettingsStore } from '../../store/settingsStore';
import { storage } from '../../services/storage';
import { useTripStore } from '../../store/tripStore';
import type { LLMProvider } from '../../types/llm';
import type { TransportMode } from '../../types/trip';

interface SettingsPageProps {
  onBack: () => void;
}

const TRANSPORT_OPTIONS: { mode: TransportMode; label: string; icon: string }[] = [
  { mode: 'walking', label: '步行', icon: '🚶' },
  { mode: 'cycling', label: '骑行', icon: '🚴' },
  { mode: 'driving', label: '驾车', icon: '🚗' },
  { mode: 'transit', label: '公交', icon: '🚌' },
];

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { config, setProvider, setApiKey, setModel, setAmapConfig, setQWeatherKey, setPreferredTransport } = useSettingsStore();
  const [amapKey, setAmapKey] = useState(config.amapApiKey ?? '');
  const [showAmapKey, setShowAmapKey] = useState(false);
  const [qKey, setQKey] = useState(config.qweatherApiKey ?? '');
  const [showQKey, setShowQKey] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trips = useTripStore((s) => s.trips);

  const providers: LLMProvider[] = ['zhipu', 'deepseek', 'anthropic'];

  const handleExport = () => {
    const snap = storage.exportSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelplan-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage(`已导出 ${snap.trips.length} 个行程`);
    setTimeout(() => setBackupMessage(null), 2400);
  };

  const handleImport = async (file: File, mode: 'merge' | 'replace') => {
    try {
      const text = await file.text();
      const snap = JSON.parse(text);
      const res = storage.importSnapshot(snap, mode);
      setBackupMessage(`导入完成：新增 ${res.added}，更新 ${res.updated}，总 ${res.total}`);
      // Reload to rehydrate store state
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setBackupMessage(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
      setTimeout(() => setBackupMessage(null), 3200);
    }
  };

  const triggerFilePick = (mode: 'merge' | 'replace') => {
    if (!fileInputRef.current) return;
    fileInputRef.current.dataset.mode = mode;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="glass-light flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)', borderBottom: '1px solid var(--color-divider)' }}>
        <button className="tap w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-divider)' }} onClick={onBack}>
          <ChevronLeft size={18} strokeWidth={2} style={{ color: 'var(--color-text)' }} />
        </button>
        <h1 className="text-[17px] font-semibold" style={{ color: 'var(--color-text)' }}>设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-ios px-4 py-4 space-y-5">

        {/* Amap config */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3 px-1">地图配置</h2>
          <div className="bg-surface rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Map size={18} strokeWidth={1.5} className="text-primary" />
              <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>高德地图 API Key</span>
            </div>
            <div className="flex items-center gap-2 px-3 h-10 rounded-xl" style={{ backgroundColor: 'var(--color-divider)' }}>
              <input
                type={showAmapKey ? 'text' : 'password'}
                value={amapKey}
                onChange={(e) => {
                  setAmapKey(e.target.value);
                  setAmapConfig(config.amapMcpEndpoint ?? '', e.target.value);
                }}
                placeholder="填入高德地图 Web API Key"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: 'var(--color-text)' }}
              />
              <button className="tap" onClick={() => setShowAmapKey(!showAmapKey)}>
                {showAmapKey
                  ? <EyeOff size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
                  : <Eye size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
                }
              </button>
            </div>
            <p className="text-[11px] text-muted mt-2">
              前往 <span className="text-primary">lbs.amap.com</span> 申请，个人开发者免费额度充足
            </p>
          </div>
        </section>

        {/* Weather config */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3 px-1">天气预报</h2>
          <div className="bg-surface rounded-2xl p-4 shadow-card space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CloudSun size={18} strokeWidth={1.5} className="text-primary" />
                <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>和风天气 API Key</span>
              </div>
              <div className="flex items-center gap-2 px-3 h-10 rounded-xl" style={{ backgroundColor: 'var(--color-divider)' }}>
                <input
                  type={showQKey ? 'text' : 'password'}
                  value={qKey}
                  onChange={(e) => { setQKey(e.target.value); setQWeatherKey(e.target.value); }}
                  placeholder="填入 QWeather API Key"
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: 'var(--color-text)' }}
                />
                <button className="tap" onClick={() => setShowQKey(!showQKey)}>
                  {showQKey
                    ? <EyeOff size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
                    : <Eye size={14} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
                  }
                </button>
              </div>
              <p className="text-[11px] text-muted mt-2">
                前往 <span className="text-primary">dev.qweather.com</span> 注册，免费额度 1000 次/天
              </p>
            </div>
          </div>
        </section>

        {/* Route planning config */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3 px-1">路线规划</h2>
          <div className="bg-surface rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Navigation size={18} strokeWidth={1.5} className="text-primary" />
              <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>默认出行方式</span>
            </div>
            <div className="flex gap-2">
              {TRANSPORT_OPTIONS.map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  className="tap flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[12px] font-medium transition-colors"
                  style={{
                    backgroundColor: config.preferredTransport === mode ? 'var(--color-primary)' : 'var(--color-divider)',
                    color: config.preferredTransport === mode ? 'white' : 'var(--color-text-secondary)',
                  }}
                  onClick={() => setPreferredTransport(mode)}
                >
                  <span className="text-[16px]">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* LLM providers */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3 px-1">AI 助手配置</h2>
          <p className="text-[12px] text-muted px-1 mb-3">选择一个 AI 提供商并填入 API Key</p>
          <div className="space-y-3">
            {providers.map((provider) => (
              <LLMProviderCard
                key={provider}
                provider={provider}
                isActive={config.activeLLMProvider === provider}
                apiKey={config.llmKeys?.[provider] ?? ''}
                model={config.llmModel?.[provider] ?? ''}
                onActivate={() => setProvider(provider)}
                onKeyChange={(key) => setApiKey(provider, key)}
                onModelChange={(model) => setModel(provider, model)}
              />
            ))}
          </div>
        </section>

        {/* Data backup */}
        <section>
          <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider mb-3 px-1">数据备份</h2>
          <div className="bg-surface rounded-2xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={18} strokeWidth={1.5} className="text-primary" />
              <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text)' }}>本地数据</span>
              <span className="pill badge-nature text-[11px]">{trips.length} 个行程</span>
            </div>
            <p className="text-[11.5px] text-muted leading-relaxed mb-3">
              所有数据仅存储于本浏览器的 localStorage。关闭/重开浏览器不会丢失，但换设备、清除站点数据或隐私模式会丢。建议定期导出备份。
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="tap flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-medium"
                style={{ backgroundColor: 'rgba(58,122,140,0.1)', color: 'var(--color-primary)' }}
                onClick={handleExport}
              >
                <Download size={13} strokeWidth={1.5} />导出 JSON
              </button>
              <button
                className="tap flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-medium"
                style={{ backgroundColor: 'var(--color-divider)', color: 'var(--color-text)' }}
                onClick={() => triggerFilePick('merge')}
              >
                <Upload size={13} strokeWidth={1.5} />合并导入
              </button>
            </div>
            <button
              className="tap w-full mt-2 py-2 rounded-xl text-[11px]"
              style={{ color: 'var(--color-accent)' }}
              onClick={() => {
                if (confirm('替换导入会清空当前全部行程，仅保留备份文件中的内容，确定继续？')) {
                  triggerFilePick('replace');
                }
              }}
            >
              替换导入（清空后再导入）
            </button>

            {backupMessage && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-[11.5px] text-center"
                style={{ backgroundColor: 'rgba(139,168,136,0.15)', color: '#5A8A56' }}
              >
                {backupMessage}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const mode = (fileInputRef.current?.dataset.mode as 'merge' | 'replace') ?? 'merge';
                handleImport(file, mode);
              }}
            />
          </div>
        </section>

        {/* Data security note */}
        <section>
          <div className="px-4 py-3.5 rounded-2xl" style={{ backgroundColor: 'rgba(139, 168, 136, 0.1)' }}>
            <div className="text-[13px] font-semibold" style={{ color: '#5A8A56' }}>🔒 数据安全</div>
            <div className="text-[12px] text-muted mt-1 leading-relaxed">
              所有 API Key 仅存储在你的浏览器本地，不经过任何第三方服务器。行程数据也仅保存在本地。启动时自动请求浏览器"持久化存储"权限，避免空间不足时被清理。
            </div>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </div>
  );
}
