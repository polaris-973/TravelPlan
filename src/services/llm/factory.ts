import type { LLMClient, LLMConfig } from './types';
import { ZhipuClient } from './zhipu';
import { DeepSeekClient } from './deepseek';
import { AnthropicClient } from './anthropic';

export function createLLMClient(config: Partial<LLMConfig>): LLMClient {
  const provider = config.activeLLMProvider ?? 'zhipu';

  switch (provider) {
    case 'zhipu': {
      const key = config.llmKeys?.zhipu;
      if (!key) throw new Error('智谱 API Key 未配置');
      return new ZhipuClient(key, config.llmModel?.zhipu);
    }
    case 'deepseek': {
      const key = config.llmKeys?.deepseek;
      if (!key) throw new Error('DeepSeek API Key 未配置');
      return new DeepSeekClient(key, config.llmModel?.deepseek);
    }
    case 'anthropic': {
      const key = config.llmKeys?.anthropic;
      if (!key) throw new Error('Anthropic API Key 未配置');
      return new AnthropicClient(key, config.llmModel?.anthropic);
    }
    default:
      throw new Error(`未知 LLM Provider: ${provider}`);
  }
}

export const PROVIDER_DEFAULTS = {
  zhipu: { model: 'glm-4-plus', name: '智谱 AI', models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'] },
  deepseek: { model: 'deepseek-chat', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'] },
  anthropic: { model: 'claude-sonnet-4-20250514', name: 'Anthropic Claude', models: ['claude-sonnet-4-20250514', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'] },
} as const;
