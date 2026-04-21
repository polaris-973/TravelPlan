import { create } from 'zustand';
import type { ChatMessage, ToolDefinition } from '../types/llm';
import { createLLMClient } from '../services/llm/factory';
import { getAmapTools, getItineraryTools, executeAmapTool } from '../services/amap/tools';
import type { LLMConfig } from '../types/llm';
import type { Trip } from '../types/trip';
import { useTripStore } from './tripStore';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  isStreaming?: boolean;
  timestamp: number;
}

interface ItineraryProposal {
  description: string;
  changes: Array<{ type: string; payload: Record<string, unknown> }>;
}

interface ChatState {
  messages: DisplayMessage[];
  history: ChatMessage[];
  isLoading: boolean;
  proposal: ItineraryProposal | null;
  sendMessage: (text: string, config: Partial<LLMConfig>, trip: Trip | null) => Promise<void>;
  acceptProposal: (tripId: string) => void;
  rejectProposal: () => void;
  clearHistory: () => void;
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function buildSystemPrompt(trip: Trip | null): string {
  const tripJson = trip ? JSON.stringify({
    title: trip.title,
    dates: `${trip.startDate} ~ ${trip.endDate}`,
    travelers: trip.travelers,
    preferences: trip.preferences,
    days: trip.days.map((d) => ({
      date: d.date,
      places: d.places.map((p) => ({ name: p.name, duration: p.durationMinutes, priority: p.priority })),
    })),
  }) : '暂无行程';

  return `你是"滇途"App 的专属旅行助手，深度理解云南旅游场景。

当前行程：
${tripJson}

今日日期：${new Date().toLocaleDateString('zh-CN')}

你的工作方式：
1. 使用工具查询地点、天气、路线等信息
2. 修改行程时，必须通过 propose_itinerary_change 工具提议变更，让用户确认，绝不直接改写
3. 回答要简洁、有温度，像一个了解云南的朋友
4. 针对云南特点提醒：高反（>2500m 需注意）、雨季（6-9 月）、少数民族礼仪、山路晕车等
5. 景点推荐要结合用户偏好和当前行程节奏

云南关键知识：
- 大理（白族）：三月街、三塔、洱海；礼仪：进白族人家需脱鞋
- 丽江（纳西族）：古城、玉龙雪山（3356m 注意高反）、泸沽湖；东巴文化
- 香格里拉（藏族）：3280m，建议提前1天适应；普达措、噶丹松赞林寺
- 西双版纳（傣族）：热带雨林、野象谷；泼水节在 4 月
- 最佳季节：11月-次年4月（旱季）；6-9月雨季但绿意盎然`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  history: [],
  isLoading: false,
  proposal: null,

  async sendMessage(text, config, trip) {
    const userMsg: DisplayMessage = { id: nanoid(), role: 'user', content: text, timestamp: Date.now() };
    const assistantId = nanoid();

    set((s) => ({
      messages: [...s.messages, userMsg, { id: assistantId, role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() }],
      history: [...s.history, { role: 'user', content: text }],
      isLoading: true,
    }));

    try {
      const client = createLLMClient(config);
      const tools: ToolDefinition[] = [...getAmapTools(), ...getItineraryTools()];
      const { history } = get();

      let continueLoop = true;
      let currentHistory = [...history];

      while (continueLoop) {
        const stream = client.chat({
          messages: currentHistory,
          tools,
          stream: true,
          systemPrompt: buildSystemPrompt(trip),
        });

        let assistantText = '';
        const toolCalls: Record<string, { name: string; args: string }> = {};
        let pendingToolCallEnd: Array<{ id: string; name: string; args: string }> = [];

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            assistantText += chunk.text;
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, content: assistantText } : m
              ),
            }));
          } else if (chunk.type === 'tool_call_start' && chunk.toolCallId) {
            toolCalls[chunk.toolCallId] = { name: chunk.toolName ?? '', args: '' };
          } else if (chunk.type === 'tool_call_delta' && chunk.toolCallId && chunk.toolArgsDelta) {
            if (toolCalls[chunk.toolCallId]) {
              toolCalls[chunk.toolCallId].args += chunk.toolArgsDelta;
            }
          } else if (chunk.type === 'tool_call_end' && chunk.toolCallId) {
            pendingToolCallEnd.push({ id: chunk.toolCallId, name: chunk.toolName ?? '', args: JSON.stringify(chunk.toolArgs ?? {}) });
          } else if (chunk.type === 'done') {
            break;
          }
        }

        if (pendingToolCallEnd.length === 0) {
          // Finalize streamed assistant message
          currentHistory = [...currentHistory, { role: 'assistant', content: assistantText }];
          set((s) => ({
            messages: s.messages.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m),
            history: currentHistory,
          }));
          continueLoop = false;
        } else {
          // Tool execution round
          const assistantHistoryMsg: ChatMessage = {
            role: 'assistant',
            content: assistantText,
            tool_calls: pendingToolCallEnd.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          };
          currentHistory = [...currentHistory, assistantHistoryMsg];

          for (const tc of pendingToolCallEnd) {
            let result = '';
            if (tc.name === 'get_current_itinerary') {
              result = trip ? JSON.stringify(trip) : '暂无行程';
            } else if (tc.name === 'propose_itinerary_change') {
              const parsed = JSON.parse(tc.args || '{}');
              set({ proposal: parsed });
              result = '已提议变更，等待用户确认';
              continueLoop = false;
            } else {
              result = await executeAmapTool(tc.name, JSON.parse(tc.args || '{}'), config.amapApiKey ?? '');
            }

            currentHistory = [...currentHistory, { role: 'tool', content: result, tool_call_id: tc.id }];

            if (tc.name !== 'propose_itinerary_change') {
              set((s) => ({
                messages: [...s.messages.filter((m) => m.id !== assistantId),
                  { id: nanoid(), role: 'tool_result', content: `[工具结果: ${tc.name}]`, timestamp: Date.now() },
                  { id: assistantId, role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() },
                ],
              }));
            }
          }
          pendingToolCallEnd = [];
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '未知错误';
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: `信号不太好呢，稍后再试一下吧 😅\n(${errMsg})`, isStreaming: false } : m
        ),
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  acceptProposal(tripId) {
    const { proposal } = get();
    if (!proposal || !tripId) { set({ proposal: null }); return; }

    const store = useTripStore.getState();
    for (const change of proposal.changes) {
      switch (change.type) {
        case 'add_place': {
          const { dayId, place } = change.payload as { dayId: string; place: import('../types/trip').PlaceVisit };
          if (dayId && place) store.addPlaceToDay(tripId, dayId, place);
          break;
        }
        case 'remove_place': {
          const { dayId, placeId } = change.payload as { dayId: string; placeId: string };
          if (dayId && placeId) store.removePlace(tripId, dayId, placeId);
          break;
        }
        case 'reorder': {
          const { dayId, placeIds } = change.payload as { dayId: string; placeIds: string[] };
          if (dayId && placeIds) store.reorderPlaces(tripId, dayId, placeIds);
          break;
        }
        case 'update_duration': {
          const { dayId, placeId, durationMinutes } = change.payload as { dayId: string; placeId: string; durationMinutes: number };
          if (dayId && placeId) store.updatePlace(tripId, dayId, placeId, { durationMinutes });
          break;
        }
        case 'update_notes': {
          const { dayId, placeId, notes } = change.payload as { dayId: string; placeId: string; notes: string };
          if (dayId && placeId) store.updatePlace(tripId, dayId, placeId, { notes: [{ id: String(Date.now()), content: notes, createdAt: new Date().toISOString(), color: 'yellow' as const }] });
          break;
        }
      }
    }
    set({ proposal: null });
  },

  rejectProposal() {
    set({ proposal: null });
  },

  clearHistory() {
    set({ messages: [], history: [], proposal: null });
  },
}));
