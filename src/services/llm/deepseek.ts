import OpenAI from 'openai';
import type { LLMClient, ChatMessage, ChatChunk, ToolDefinition } from './types';

export class DeepSeekClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'deepseek-chat') {
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      dangerouslyAllowBrowser: true,
    });
  }

  async *chat(params: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    stream: true;
    systemPrompt?: string;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncIterable<ChatChunk> {
    const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (params.systemPrompt) {
      msgs.push({ role: 'system', content: params.systemPrompt });
    }
    for (const m of params.messages) {
      if (m.role === 'tool') {
        msgs.push({
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_call_id: m.tool_call_id ?? '',
        });
      } else if (m.role === 'assistant' && m.tool_calls) {
        msgs.push({ role: 'assistant', content: null, tool_calls: m.tool_calls as OpenAI.Chat.ChatCompletionMessageToolCall[] });
      } else {
        msgs.push({
          role: m.role as 'user' | 'assistant' | 'system',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        });
      }
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: msgs,
      tools: params.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
      stream: true,
      max_tokens: params.maxTokens,
    }, { signal: params.signal });

    const toolCallBuffers: Record<string, { name: string; args: string }> = {};

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: 'text', text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const id = tc.id ?? `tc_${tc.index}`;
          if (!toolCallBuffers[id]) {
            toolCallBuffers[id] = { name: tc.function?.name ?? '', args: '' };
            yield { type: 'tool_call_start', toolCallId: id, toolName: tc.function?.name };
          }
          if (tc.function?.arguments) {
            toolCallBuffers[id].args += tc.function.arguments;
            yield { type: 'tool_call_delta', toolCallId: id, toolArgsDelta: tc.function.arguments };
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        for (const [id, buf] of Object.entries(toolCallBuffers)) {
          try {
            yield { type: 'tool_call_end', toolCallId: id, toolName: buf.name, toolArgs: JSON.parse(buf.args || '{}') };
          } catch {
            yield { type: 'tool_call_end', toolCallId: id, toolName: buf.name, toolArgs: {} };
          }
        }
      }
    }
    yield { type: 'done' };
  }
}
