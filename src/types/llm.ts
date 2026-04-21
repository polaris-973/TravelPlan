export type LLMProvider = 'zhipu' | 'deepseek' | 'anthropic';

export interface LLMConfig {
  activeLLMProvider: LLMProvider;
  llmKeys: {
    zhipu?: string;
    deepseek?: string;
    anthropic?: string;
  };
  llmModel?: {
    zhipu?: string;
    deepseek?: string;
    anthropic?: string;
  };
  amapMcpEndpoint: string;
  amapApiKey?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | ContentBlock[];
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ChatChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done';
  text?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgsDelta?: string;
  toolArgs?: Record<string, unknown>;
}

export interface LLMClient {
  chat(params: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    stream: true;
    systemPrompt?: string;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncIterable<ChatChunk>;
}

export type McpToolSchema = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};
