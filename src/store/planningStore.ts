import { create } from 'zustand';
import { createLLMClient } from '../services/llm/factory';
import { getPlanningTools, executeAmapTool } from '../services/amap/tools';
import {
  buildPlanningSystemPrompt, buildRefinementSystemPrompt,
  PLANNING_INITIAL_USER_MESSAGE, TOOL_PROGRESS_MESSAGES,
} from '../services/planning/planningPrompt';
import { parseSmartPlan, smartPlanToTripDays } from '../services/planning/planningParser';
import type {
  SavedPlan, PlacePlanInput, TripIntake, SmartPlan, Trip, PlaceVisit, PlaceCategory, PlaceIndoorType,
} from '../types/trip';
import type { LLMConfig, ChatMessage } from '../types/llm';

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export type PlanningPhase = 'idle' | 'gathering_data' | 'optimizing' | 'done' | 'error';

export interface PlanningProgress {
  phase: PlanningPhase;
  currentTool?: string;
  toolCallCount: number;
  message: string;
}

export type PlanEventKind =
  | 'text'           // LLM free-text chunk (reasoning)
  | 'tool_start'     // tool call started, args known
  | 'tool_end'       // tool call finished, has summary
  | 'tool_error'     // tool call threw (rare — most are caught and returned as strings)
  | 'info'           // generic status message (connecting, retrying…)
  | 'error';         // fatal error

export interface PlanEvent {
  id: string;
  at: number;                      // ms timestamp
  kind: PlanEventKind;
  toolName?: string;
  /** Short argument summary (e.g. "keywords=昆明站 city=昆明") */
  argsSummary?: string;
  /** Short result summary (e.g. "matrix: 6 results · mode=driving") */
  resultSummary?: string;
  /** Duration of the tool call in ms (populated on tool_end) */
  durationMs?: number;
  /** Free-form text (for 'text', 'info', 'error') */
  text?: string;
}

interface PlanningState {
  isGenerating: boolean;
  progress: PlanningProgress;
  events: PlanEvent[];
  currentDraft: SavedPlan | null;
  currentError: string | null;

  generatePlan: (
    trip: Trip,
    intake: TripIntake,
    places: PlacePlanInput[],
    config: Partial<LLMConfig>,
  ) => Promise<SavedPlan | null>;
  refinePlan: (
    trip: Trip,
    basePlan: SavedPlan,
    userRequest: string,
    config: Partial<LLMConfig>,
  ) => Promise<SavedPlan | null>;
  cancelGeneration: () => void;
  clearDraft: () => void;

  _abortController: AbortController | null;
}

// ── Summarizers: keep event payloads short & readable ──
function summarizeArgs(name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'amap_search_poi':
        return `关键词="${args.keywords ?? ''}" 城市="${args.city ?? '云南'}"`;
      case 'amap_get_weather':
        return `城市="${args.city ?? ''}"`;
      case 'amap_geocode':
        return `地址="${args.address ?? ''}"`;
      case 'amap_route_matrix': {
        const o = Array.isArray(args.origins) ? args.origins.length : 0;
        const d = Array.isArray(args.destinations) ? args.destinations.length : 0;
        return `起点×${o} 目的地×${d} 模式=${args.mode ?? 'driving'}`;
      }
      case 'amap_place_detail':
        return `POI=${args.poi_id ?? ''}`;
      case 'web_search':
        return `查询="${args.query ?? ''}"`;
      case 'propose_smart_plan': {
        const days = Array.isArray(args.days) ? args.days.length : 0;
        return `最终方案 · ${days} 天`;
      }
      default: {
        const s = JSON.stringify(args);
        return s.length > 80 ? s.slice(0, 77) + '…' : s;
      }
    }
  } catch { return ''; }
}

function summarizeResult(name: string, raw: string): string {
  try {
    const j = JSON.parse(raw);
    switch (name) {
      case 'amap_route_matrix': {
        const n = Array.isArray(j?.matrix) ? j.matrix.length : 0;
        const partial = j?.partial ? `（${(j.failedDestinations ?? []).length} 个失败）` : '';
        return `矩阵 ${n} 条${partial}`;
      }
      case 'amap_get_weather':
        return `天气预报 ${Array.isArray(j) ? j.length : 0} 天`;
      case 'amap_search_poi':
        return `${Array.isArray(j) ? j.length : 0} 个结果`;
      case 'amap_place_detail':
        return typeof j === 'object' && j?.name ? `${j.name}${j.openingHours ? ' · ' + j.openingHours : ''}` : '详情';
      case 'web_search':
        return `${Array.isArray(j?.results) ? j.results.length : 0} 个结果`;
      default:
        return raw.length > 60 ? raw.slice(0, 57) + '…' : raw;
    }
  } catch {
    return raw.length > 60 ? raw.slice(0, 57) + '…' : raw;
  }
}

// Helper: build a default name for a newly generated plan
function defaultPlanName(existingCount: number): string {
  const now = new Date();
  const mm = now.getMonth() + 1;
  const dd = now.getDate();
  return `方案 ${existingCount + 1} · ${mm}月${dd}日生成`;
}

export function placeVisitToPlanInput(p: PlaceVisit): PlacePlanInput {
  return {
    placeId: p.placeId,
    name: p.name,
    location: p.location,
    category: p.category as PlaceCategory,
    address: p.address,
    indoorType: guessIndoorType(p.category as PlaceCategory),
    activities: p.notes?.[0]?.content ?? '',
    durationMinutes: p.durationMinutes,
    priority: p.priority,
    openingHours: p.openingHours,
    ticketPrice: p.ticketPrice,
  };
}

function guessIndoorType(category: PlaceCategory): PlaceIndoorType {
  if (['food', 'hotel', 'shopping'].includes(category)) return 'indoor';
  if (['nature'].includes(category)) return 'outdoor';
  if (['heritage', 'activity'].includes(category)) return 'mixed';
  return 'unknown';
}

export const usePlanningStore = create<PlanningState>((set, get) => {
  // ── Event helpers (defined inside closure so they can use `set`) ──────
  const pushEvent = (kind: PlanEventKind, fields: Omit<PlanEvent, 'id' | 'at' | 'kind'> = {}) => {
    const ev: PlanEvent = { id: nanoid(), at: Date.now(), kind, ...fields };
    set((s) => ({ events: [...s.events, ev] }));
    return ev;
  };

  /** Append text to an existing event (used to stream LLM reasoning live). */
  const appendToEvent = (id: string, chunk: string) => {
    set((s) => ({
      events: s.events.map((e) => e.id === id ? { ...e, text: (e.text ?? '') + chunk } : e),
    }));
  };

  return {
    isGenerating: false,
    progress: { phase: 'idle', toolCallCount: 0, message: '' },
    events: [],
    currentDraft: null,
    currentError: null,
    _abortController: null,

    clearDraft() {
      set({
        currentDraft: null,
        currentError: null,
        events: [],
        progress: { phase: 'idle', toolCallCount: 0, message: '' },
      });
    },

    cancelGeneration() {
      const { _abortController } = get();
      _abortController?.abort();
      pushEvent('info', { text: '用户已取消规划' });
      set({ isGenerating: false, _abortController: null });
    },

    async generatePlan(trip, intake, places, config) {
    const controller = new AbortController();
    set({
      isGenerating: true,
      _abortController: controller,
      currentDraft: null,
      currentError: null,
      events: [],
      progress: { phase: 'gathering_data', toolCallCount: 0, message: '准备开始规划…' },
    });
    pushEvent('info', { text: `开始规划：${trip.title} · ${places.length} 个景点 · ${intake.arrivalAirport.name || '未指定机场'}` });

    const systemPrompt = buildPlanningSystemPrompt({
      tripTitle: trip.title,
      intake,
      places,
      hotelHints: trip.hotels ?? [],
      currentDate: new Date().toISOString().split('T')[0],
    });

    const tools = getPlanningTools();
    const apiKey = config.amapApiKey ?? '';
    let history: ChatMessage[] = [{ role: 'user', content: PLANNING_INITIAL_USER_MESSAGE }];
    let toolCallCount = 0;

    try {
      const client = createLLMClient(config);
      let continueLoop = true;
      let finalPlan: SmartPlan | null = null;
      let llmFailureRetries = 0;

      while (continueLoop) {
        if (controller.signal.aborted) break;

        let stream;
        try {
          stream = client.chat({
            messages: history,
            tools,
            stream: true,
            systemPrompt,
            maxTokens: 8000,
            signal: controller.signal,
          });
        } catch (err) {
          if (llmFailureRetries < 1) {
            llmFailureRetries++;
            pushEvent('info', { text: `LLM 连接失败（${(err as Error).message}），1 秒后重试…` });
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw err;
        }

        let assistantText = '';
        const toolCallBuffers: Record<string, { name: string; args: string }> = {};
        const pendingEnds: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
        // Stream the LLM's reasoning token-by-token into a single live event.
        let liveTextEventId: string | null = null;

        try {
          for await (const chunk of stream) {
            if (controller.signal.aborted) { continueLoop = false; break; }

            if (chunk.type === 'text' && chunk.text) {
              assistantText += chunk.text;
              if (!liveTextEventId) {
                liveTextEventId = pushEvent('text', { text: chunk.text }).id;
              } else {
                appendToEvent(liveTextEventId, chunk.text);
              }
            } else if (chunk.type === 'tool_call_start' && chunk.toolCallId) {
              // Seal the current text event when a tool call begins
              liveTextEventId = null;
              toolCallBuffers[chunk.toolCallId] = { name: chunk.toolName ?? '', args: '' };
              const msg = TOOL_PROGRESS_MESSAGES[chunk.toolName ?? ''] ?? `调用 ${chunk.toolName}…`;
              set((s) => ({ progress: { ...s.progress, currentTool: chunk.toolName, message: msg } }));
            } else if (chunk.type === 'tool_call_delta' && chunk.toolCallId) {
              if (toolCallBuffers[chunk.toolCallId]) toolCallBuffers[chunk.toolCallId].args += chunk.toolArgsDelta ?? '';
            } else if (chunk.type === 'tool_call_end' && chunk.toolCallId) {
              pendingEnds.push({ id: chunk.toolCallId, name: chunk.toolName ?? '', args: chunk.toolArgs ?? {} });
            } else if (chunk.type === 'done') {
              break;
            }
          }
        } catch (err) {
          // Stream failed mid-flight (network blip on mobile etc.). Retry once.
          if (llmFailureRetries < 1) {
            llmFailureRetries++;
            pushEvent('info', { text: `LLM 流式响应中断（${(err as Error).message}），1 秒后重试…` });
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw err;
        }

        if (controller.signal.aborted) break;

        if (pendingEnds.length === 0) {
          if (!assistantText.trim()) throw new Error('LLM 未生成任何内容，请重试');
          throw new Error('LLM 未调用 propose_smart_plan 工具，请重新规划');
        }

        history = [...history, {
          role: 'assistant',
          content: assistantText,
          tool_calls: pendingEnds.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        }];

        for (const tc of pendingEnds) {
          toolCallCount++;
          set((s) => ({ progress: { ...s.progress, toolCallCount } }));

          pushEvent('tool_start', {
            toolName: tc.name,
            argsSummary: summarizeArgs(tc.name, tc.args),
          });
          const t0 = Date.now();

          if (tc.name === 'propose_smart_plan') {
            const plan: SmartPlan = parseSmartPlan(
              tc.args,
              nanoid(),
              places,
              trip.hotels ?? [],
              config.activeLLMProvider ?? 'zhipu',
            );
            pushEvent('tool_end', {
              toolName: tc.name,
              resultSummary: `已生成 ${plan.days.length} 天方案${plan.recommendedReturnAirport ? '，推荐返程机场：' + plan.recommendedReturnAirport.name : ''}`,
              durationMs: Date.now() - t0,
            });
            finalPlan = plan;
            continueLoop = false;
            break;
          }

          try {
            const result = await executeAmapTool(tc.name, tc.args, apiKey, config);
            pushEvent('tool_end', {
              toolName: tc.name,
              resultSummary: summarizeResult(tc.name, result),
              durationMs: Date.now() - t0,
            });
            history = [...history, { role: 'tool', content: result, tool_call_id: tc.id }];
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            pushEvent('tool_error', {
              toolName: tc.name,
              text: `工具调用失败：${msg}`,
              durationMs: Date.now() - t0,
            });
            // Feed the error back to the LLM so it can decide to retry or fall back
            history = [...history, { role: 'tool', content: `错误：${msg}`, tool_call_id: tc.id }];
          }

          if (history.length > 24) {
            history = [history[0], ...history.slice(-20)];
          }
        }
      }

      if (controller.signal.aborted || !finalPlan) {
        set({ isGenerating: false, _abortController: null });
        return null;
      }

      // Wrap into SavedPlan
      const { days } = smartPlanToTripDays(finalPlan, places);
      const existingCount = (trip.savedPlans ?? []).length;
      const saved: SavedPlan = {
        id: nanoid(),
        tripId: trip.id,
        name: defaultPlanName(existingCount),
        intake,
        places,
        days,
        smartPlan: finalPlan,
        recommendedReturnAirport: finalPlan.recommendedReturnAirport,
        createdAt: new Date().toISOString(),
        llmModel: config.activeLLMProvider ?? 'zhipu',
      };

      pushEvent('info', { text: `规划完成，共 ${saved.smartPlan.days.length} 天，${toolCallCount} 次工具调用` });
      set({
        isGenerating: false,
        _abortController: null,
        currentDraft: saved,
        progress: { phase: 'done', toolCallCount, message: '规划完成！' },
      });
      return saved;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        set({ isGenerating: false, _abortController: null, progress: { phase: 'idle', toolCallCount: 0, message: '' } });
        return null;
      }
      const msg = err instanceof Error ? err.message : '规划失败，请重试';
      pushEvent('error', { text: msg });
      set({
        isGenerating: false,
        _abortController: null,
        currentError: msg,
        progress: { phase: 'error', toolCallCount, message: msg },
      });
      return null;
    }
  },

    async refinePlan(trip, basePlan, userRequest, config) {
    const controller = new AbortController();
    set({
      isGenerating: true,
      _abortController: controller,
      currentDraft: null,
      currentError: null,
      events: [],
      progress: { phase: 'gathering_data', toolCallCount: 0, message: '读取现有方案，准备调整…' },
    });
    pushEvent('info', { text: `开始调整方案 "${basePlan.name}"：${userRequest.slice(0, 50)}${userRequest.length > 50 ? '…' : ''}` });

    const systemPrompt = buildRefinementSystemPrompt({
      tripTitle: trip.title,
      intake: basePlan.intake,
      places: basePlan.places,
      hotelHints: trip.hotels ?? [],
      existingPlan: basePlan.smartPlan,
      currentDate: new Date().toISOString().split('T')[0],
    });

    const tools = getPlanningTools();
    const apiKey = config.amapApiKey ?? '';
    let history: ChatMessage[] = [{
      role: 'user',
      content: `请根据以下调整需求修订现有方案，并调用 propose_smart_plan 输出完整的修订版方案：\n\n${userRequest}`,
    }];
    let toolCallCount = 0;

    try {
      const client = createLLMClient(config);
      let continueLoop = true;
      let finalPlan: SmartPlan | null = null;
      let llmFailureRetries = 0;

      while (continueLoop) {
        if (controller.signal.aborted) break;

        let stream;
        try {
          stream = client.chat({
            messages: history,
            tools,
            stream: true,
            systemPrompt,
            maxTokens: 8000,
            signal: controller.signal,
          });
        } catch (err) {
          if (llmFailureRetries < 1) {
            llmFailureRetries++;
            pushEvent('info', { text: `LLM 连接失败，重试中…` });
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw err;
        }

        let assistantText = '';
        const toolCallBuffers: Record<string, { name: string; args: string }> = {};
        const pendingEnds: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
        let liveTextEventId: string | null = null;

        try {
          for await (const chunk of stream) {
            if (controller.signal.aborted) { continueLoop = false; break; }
            if (chunk.type === 'text' && chunk.text) {
              assistantText += chunk.text;
              if (!liveTextEventId) {
                liveTextEventId = pushEvent('text', { text: chunk.text }).id;
              } else {
                appendToEvent(liveTextEventId, chunk.text);
              }
            } else if (chunk.type === 'tool_call_start' && chunk.toolCallId) {
              liveTextEventId = null;
              toolCallBuffers[chunk.toolCallId] = { name: chunk.toolName ?? '', args: '' };
              const msg = TOOL_PROGRESS_MESSAGES[chunk.toolName ?? ''] ?? `调用 ${chunk.toolName}…`;
              set((s) => ({ progress: { ...s.progress, currentTool: chunk.toolName, message: msg } }));
            } else if (chunk.type === 'tool_call_delta' && chunk.toolCallId) {
              if (toolCallBuffers[chunk.toolCallId]) toolCallBuffers[chunk.toolCallId].args += chunk.toolArgsDelta ?? '';
            } else if (chunk.type === 'tool_call_end' && chunk.toolCallId) {
              pendingEnds.push({ id: chunk.toolCallId, name: chunk.toolName ?? '', args: chunk.toolArgs ?? {} });
            } else if (chunk.type === 'done') {
              break;
            }
          }
        } catch (err) {
          if (llmFailureRetries < 1) {
            llmFailureRetries++;
            pushEvent('info', { text: `LLM 流式响应中断，重试中…` });
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          throw err;
        }

        if (controller.signal.aborted) break;

        if (pendingEnds.length === 0) {
          if (!assistantText.trim()) throw new Error('LLM 未生成任何内容，请重试');
          throw new Error('LLM 未调用 propose_smart_plan 工具，请重新调整');
        }

        history = [...history, {
          role: 'assistant',
          content: assistantText,
          tool_calls: pendingEnds.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        }];

        for (const tc of pendingEnds) {
          toolCallCount++;
          set((s) => ({ progress: { ...s.progress, toolCallCount } }));

          pushEvent('tool_start', {
            toolName: tc.name,
            argsSummary: summarizeArgs(tc.name, tc.args),
          });
          const t0 = Date.now();

          if (tc.name === 'propose_smart_plan') {
            const plan: SmartPlan = parseSmartPlan(
              tc.args,
              nanoid(),
              basePlan.places,
              trip.hotels ?? [],
              config.activeLLMProvider ?? 'zhipu',
            );
            pushEvent('tool_end', {
              toolName: tc.name,
              resultSummary: `已生成调整版方案 · ${plan.days.length} 天`,
              durationMs: Date.now() - t0,
            });
            finalPlan = plan;
            continueLoop = false;
            break;
          }

          try {
            const result = await executeAmapTool(tc.name, tc.args, apiKey, config);
            pushEvent('tool_end', {
              toolName: tc.name,
              resultSummary: summarizeResult(tc.name, result),
              durationMs: Date.now() - t0,
            });
            history = [...history, { role: 'tool', content: result, tool_call_id: tc.id }];
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            pushEvent('tool_error', { toolName: tc.name, text: `工具调用失败：${msg}`, durationMs: Date.now() - t0 });
            history = [...history, { role: 'tool', content: `错误：${msg}`, tool_call_id: tc.id }];
          }

          if (history.length > 24) history = [history[0], ...history.slice(-20)];
        }
      }

      if (controller.signal.aborted || !finalPlan) {
        set({ isGenerating: false, _abortController: null });
        return null;
      }

      const { days } = smartPlanToTripDays(finalPlan, basePlan.places);
      const existingCount = (trip.savedPlans ?? []).length;
      const revised: SavedPlan = {
        id: nanoid(),
        tripId: trip.id,
        name: `${basePlan.name} · 调整版 ${existingCount + 1}`,
        intake: basePlan.intake,
        places: basePlan.places,
        days,
        smartPlan: finalPlan,
        recommendedReturnAirport: finalPlan.recommendedReturnAirport ?? basePlan.recommendedReturnAirport,
        createdAt: new Date().toISOString(),
        llmModel: config.activeLLMProvider ?? 'zhipu',
      };

      pushEvent('info', { text: `调整完成，${toolCallCount} 次工具调用` });
      set({
        isGenerating: false,
        _abortController: null,
        currentDraft: revised,
        progress: { phase: 'done', toolCallCount, message: '调整完成！' },
      });
      return revised;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        set({ isGenerating: false, _abortController: null, progress: { phase: 'idle', toolCallCount: 0, message: '' } });
        return null;
      }
      const msg = err instanceof Error ? err.message : '调整失败，请重试';
      pushEvent('error', { text: msg });
      set({
        isGenerating: false,
        _abortController: null,
        currentError: msg,
        progress: { phase: 'error', toolCallCount, message: msg },
      });
      return null;
    }
  },
  };
});
