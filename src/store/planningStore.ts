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

interface PlanningState {
  isGenerating: boolean;
  progress: PlanningProgress;
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

export const usePlanningStore = create<PlanningState>((set, get) => ({
  isGenerating: false,
  progress: { phase: 'idle', toolCallCount: 0, message: '' },
  currentDraft: null,
  currentError: null,
  _abortController: null,

  clearDraft() {
    set({ currentDraft: null, currentError: null, progress: { phase: 'idle', toolCallCount: 0, message: '' } });
  },

  cancelGeneration() {
    const { _abortController } = get();
    _abortController?.abort();
    set({ isGenerating: false, _abortController: null });
  },

  async generatePlan(trip, intake, places, config) {
    const controller = new AbortController();
    set({
      isGenerating: true,
      _abortController: controller,
      currentDraft: null,
      currentError: null,
      progress: { phase: 'gathering_data', toolCallCount: 0, message: '准备开始规划…' },
    });

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

      while (continueLoop) {
        if (controller.signal.aborted) break;

        const stream = client.chat({
          messages: history,
          tools,
          stream: true,
          systemPrompt,
          maxTokens: 8000,
          signal: controller.signal,
        });

        let assistantText = '';
        const toolCallBuffers: Record<string, { name: string; args: string }> = {};
        const pendingEnds: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
          if (controller.signal.aborted) { continueLoop = false; break; }

          if (chunk.type === 'text' && chunk.text) {
            assistantText += chunk.text;
          } else if (chunk.type === 'tool_call_start' && chunk.toolCallId) {
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

          if (tc.name === 'propose_smart_plan') {
            const plan: SmartPlan = parseSmartPlan(
              tc.args,
              nanoid(),
              places,
              trip.hotels ?? [],
              config.activeLLMProvider ?? 'zhipu',
            );
            finalPlan = plan;
            continueLoop = false;
            break;
          }

          const result = await executeAmapTool(tc.name, tc.args, apiKey, config);
          history = [...history, { role: 'tool', content: result, tool_call_id: tc.id }];

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
      progress: { phase: 'gathering_data', toolCallCount: 0, message: '读取现有方案，准备调整…' },
    });

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

      while (continueLoop) {
        if (controller.signal.aborted) break;

        const stream = client.chat({
          messages: history,
          tools,
          stream: true,
          systemPrompt,
          maxTokens: 8000,
          signal: controller.signal,
        });

        let assistantText = '';
        const toolCallBuffers: Record<string, { name: string; args: string }> = {};
        const pendingEnds: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

        for await (const chunk of stream) {
          if (controller.signal.aborted) { continueLoop = false; break; }
          if (chunk.type === 'text' && chunk.text) {
            assistantText += chunk.text;
          } else if (chunk.type === 'tool_call_start' && chunk.toolCallId) {
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

          if (tc.name === 'propose_smart_plan') {
            const plan: SmartPlan = parseSmartPlan(
              tc.args,
              nanoid(),
              basePlan.places,
              trip.hotels ?? [],
              config.activeLLMProvider ?? 'zhipu',
            );
            finalPlan = plan;
            continueLoop = false;
            break;
          }

          const result = await executeAmapTool(tc.name, tc.args, apiKey, config);
          history = [...history, { role: 'tool', content: result, tool_call_id: tc.id }];
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
      set({
        isGenerating: false,
        _abortController: null,
        currentError: msg,
        progress: { phase: 'error', toolCallCount, message: msg },
      });
      return null;
    }
  },
}));
