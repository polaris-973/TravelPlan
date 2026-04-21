import { create } from 'zustand';
import { storage } from '../services/storage';
import type { LLMConfig, LLMProvider } from '../types/llm';
import type { TransportMode } from '../types/trip';

interface SettingsState {
  config: Partial<LLMConfig> & {
    qweatherApiKey?: string;
    preferredTransport?: TransportMode;
  };
  setProvider: (provider: LLMProvider) => void;
  setApiKey: (provider: LLMProvider, key: string) => void;
  setModel: (provider: LLMProvider, model: string) => void;
  setAmapConfig: (endpoint: string, apiKey?: string) => void;
  setQWeatherKey: (key: string) => void;
  setPreferredTransport: (mode: TransportMode) => void;
  isConfigured: () => boolean;
}

const savedConfig = storage.getConfig();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  config: {
    activeLLMProvider: 'zhipu',
    llmKeys: {},
    llmModel: {},
    amapMcpEndpoint: '',
    qweatherApiKey: '',
    preferredTransport: 'walking',
    ...savedConfig,
  },

  setProvider(provider) {
    set((s) => {
      const config = { ...s.config, activeLLMProvider: provider };
      storage.saveConfig(config);
      return { config };
    });
  },

  setApiKey(provider, key) {
    set((s) => {
      const config = { ...s.config, llmKeys: { ...s.config.llmKeys, [provider]: key } };
      storage.saveConfig(config);
      return { config };
    });
  },

  setModel(provider, model) {
    set((s) => {
      const config = { ...s.config, llmModel: { ...s.config.llmModel, [provider]: model } };
      storage.saveConfig(config);
      return { config };
    });
  },

  setAmapConfig(endpoint, apiKey) {
    set((s) => {
      const config = { ...s.config, amapMcpEndpoint: endpoint, amapApiKey: apiKey };
      storage.saveConfig(config);
      return { config };
    });
  },

  setQWeatherKey(key) {
    set((s) => {
      const config = { ...s.config, qweatherApiKey: key };
      storage.saveConfig(config);
      return { config };
    });
  },

  setPreferredTransport(mode) {
    set((s) => {
      const config = { ...s.config, preferredTransport: mode };
      storage.saveConfig(config);
      return { config };
    });
  },

  isConfigured() {
    const { config } = get();
    const provider = config.activeLLMProvider ?? 'zhipu';
    const hasLLMKey = !!config.llmKeys?.[provider];
    const hasAmap = !!(config.amapApiKey);
    return hasLLMKey && hasAmap;
  },
}));
