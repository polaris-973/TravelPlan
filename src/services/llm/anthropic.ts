import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, ChatMessage, ChatChunk, ToolDefinition } from './types';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.model = model;
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async *chat(params: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    stream: true;
    systemPrompt?: string;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncIterable<ChatChunk> {
    const msgs: Anthropic.MessageParam[] = [];

    for (const m of params.messages) {
      if (m.role === 'system') continue;
      if (m.role === 'tool') {
        const last = msgs[msgs.length - 1];
        const block: Anthropic.ToolResultBlockParam = {
          type: 'tool_result',
          tool_use_id: m.tool_call_id ?? '',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        };
        if (last?.role === 'user' && Array.isArray(last.content)) {
          (last.content as Anthropic.ContentBlockParam[]).push(block);
        } else {
          msgs.push({ role: 'user', content: [block] });
        }
        continue;
      }
      if (m.role === 'assistant' && m.tool_calls) {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (typeof m.content === 'string' && m.content) {
          blocks.push({ type: 'text', text: m.content });
        }
        for (const tc of m.tool_calls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
          });
        }
        msgs.push({ role: 'assistant', content: blocks });
        continue;
      }
      msgs.push({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      });
    }

    const anthropicTools: Anthropic.Tool[] | undefined = params.tools?.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
    }));

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.systemPrompt,
      messages: msgs,
      tools: anthropicTools,
    }, { signal: params.signal });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          yield { type: 'tool_call_start', toolCallId: event.content_block.id, toolName: event.content_block.name };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          yield { type: 'tool_call_delta', toolArgsDelta: event.delta.partial_json };
        }
      } else if (event.type === 'content_block_stop') {
        const msg = await stream.finalMessage().catch(() => null);
        if (msg) {
          for (const block of msg.content) {
            if (block.type === 'tool_use') {
              yield { type: 'tool_call_end', toolCallId: block.id, toolName: block.name, toolArgs: block.input as Record<string, unknown> };
            }
          }
        }
      }
    }
    yield { type: 'done' };
  }
}
