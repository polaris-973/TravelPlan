import { Bot } from 'lucide-react';
import type { DisplayMessage } from '../../store/chatStore';

interface MessageBubbleProps {
  message: DisplayMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isToolResult = message.role === 'tool_result';

  if (isToolResult) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] text-subtle px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--color-divider)' }}>
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-2`}>
      {isAssistant && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5">
          <Bot size={14} strokeWidth={1.5} className="text-white" />
        </div>
      )}

      <div
        className="max-w-[78%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed"
        style={
          isUser
            ? { backgroundColor: 'var(--color-primary)', color: 'white', borderBottomRightRadius: 6 }
            : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: 'var(--shadow-sm)', borderBottomLeftRadius: 6 }
        }
      >
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-1.5 py-1">
            <div className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
            <div className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
            <div className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
        ) : (
          <span className="whitespace-pre-wrap break-words">{message.content}</span>
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-0.5 h-3.5 bg-current animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}
