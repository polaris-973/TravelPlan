import type { ToolDefinition } from '../../types/llm';
import { searchPOI, getWeather, geocode } from './loader';
import { fetchJson } from '../http';
import type { LLMConfig } from '../../types/llm';

export function getAmapTools(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'amap_search_poi',
        description: '搜索云南地区的兴趣点（景区、餐厅、酒店等）',
        parameters: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: '搜索关键词，如"大理古城"、"玉龙雪山"' },
            city: { type: 'string', description: '城市名，默认"云南"' },
          },
          required: ['keywords'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'amap_get_weather',
        description: '获取某地区天气预报（未来7天）',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名或高德行政区编码，如"大理"、"530100"' },
          },
          required: ['city'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'amap_geocode',
        description: '将地址转换为经纬度坐标',
        parameters: {
          type: 'object',
          properties: {
            address: { type: 'string', description: '详细地址，如"云南省大理市古城区人民路"' },
          },
          required: ['address'],
        },
      },
    },
  ];
}

export function getItineraryTools(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_current_itinerary',
        description: '获取当前行程的完整信息，包括所有天的地点安排',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'propose_itinerary_change',
        description: '提议修改行程，修改需用户确认后才生效。不要直接操作行程，始终通过此工具提议变更。',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: '用中文描述本次变更的内容和原因' },
            changes: {
              type: 'array',
              description: '具体变更列表',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['add_place', 'remove_place', 'reorder', 'update_notes', 'change_day', 'update_duration'] },
                  payload: { type: 'object' },
                },
                required: ['type', 'payload'],
              },
            },
          },
          required: ['description', 'changes'],
        },
      },
    },
  ];
}

// ── 智能规划专用工具 ─────────────────────────────────────────────────────────

export function getPlanningTools(): ToolDefinition[] {
  return [
    ...getAmapTools(),
    {
      type: 'function',
      function: {
        name: 'amap_route_matrix',
        description: '批量计算多个地点之间的行车/步行时间和距离矩阵，用于规划时一次性获取所有地点对的交通信息。',
        parameters: {
          type: 'object',
          properties: {
            origins: {
              type: 'array',
              description: '出发地列表，每项格式 "lng,lat|名称"，最多10个',
              items: { type: 'string' },
            },
            destinations: {
              type: 'array',
              description: '目的地列表，每项格式 "lng,lat|名称"，最多10个',
              items: { type: 'string' },
            },
            mode: {
              type: 'string',
              enum: ['driving', 'walking'],
              description: '出行方式，默认 driving',
            },
          },
          required: ['origins', 'destinations'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'amap_place_detail',
        description: '获取景点详细信息，包括开放时间、门票价格、评分',
        parameters: {
          type: 'object',
          properties: {
            poi_id: { type: 'string', description: '高德 POI ID' },
          },
          required: ['poi_id'],
        },
      },
    },
    // web_search removed — always returned empty results, wasted a tool-call round-trip.
    // LLM should use its training knowledge + amap_place_detail for live data.
    {
      type: 'function',
      function: {
        name: 'propose_smart_plan',
        description: '输出完整的智能规划方案（结构化）。所有工具数据收集完毕后调用此工具，禁止用文字描述方案。',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: '规划总体说明和注意事项（200字以内）' },
            days: {
              type: 'array',
              description: '逐日日程安排',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'YYYY-MM-DD' },
                  hotel_id: { type: 'string', description: '当晚入住酒店 ID' },
                  ai_summary: { type: 'string', description: '当天概述（50-100字，含天气提示）' },
                  stops: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['hotel_depart', 'place', 'lunch', 'dinner', 'hotel_arrive', 'transport'], description: '跨城高铁段用 transport' },
                        place_id: { type: 'string' },
                        hotel_id: { type: 'string' },
                        name: { type: 'string' },
                        location: { type: 'object', properties: { lng: { type: 'number' }, lat: { type: 'number' } } },
                        arrival_time: { type: 'string', description: 'HH:MM（24小时制）' },
                        departure_time: { type: 'string', description: 'HH:MM（24小时制）' },
                        duration_minutes: { type: 'number' },
                        notes: { type: 'string', description: '实用建议（可选）' },
                        weather_warning: { type: 'string', description: '天气提示（仅天气不佳时填写）' },
                        transport_to_next: {
                          type: 'object',
                          properties: {
                            mode: { type: 'string', enum: ['driving', 'walking', 'transit', 'cycling', 'highspeedrail', 'flight'] },
                            duration_minutes: { type: 'number' },
                            distance_km: { type: 'number' },
                          },
                        },
                      },
                      required: ['type', 'name', 'arrival_time', 'departure_time', 'duration_minutes'],
                    },
                  },
                },
                required: ['date', 'hotel_id', 'stops', 'ai_summary'],
              },
            },
            unscheduled_places: {
              type: 'array',
              description: '因时间不足未安排的景点',
              items: {
                type: 'object',
                properties: {
                  place_id: { type: 'string' },
                  name: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
            recommended_return_airport: {
              type: 'object',
              description: '基于最后一天行程推荐的返程机场',
              properties: {
                name: { type: 'string', description: '机场全名，如"丽江三义国际机场"' },
                code: { type: 'string', description: 'IATA三字码，如 LJG' },
                city: { type: 'string', description: '机场所在城市' },
                distance_km: { type: 'number', description: '从最后一天行程结束地点到机场的距离' },
                reason: { type: 'string', description: '推荐理由（50字内）' },
              },
              required: ['name', 'city', 'reason'],
            },
          },
          required: ['summary', 'days', 'recommended_return_airport'],
        },
      },
    },
    ...getItineraryTools(),
  ];
}

// ── 工具执行 ──────────────────────────────────────────────────────────────────

export async function executeAmapTool(
  toolName: string,
  args: Record<string, unknown>,
  apiKey: string,
  _llmConfig?: Partial<LLMConfig>,
): Promise<string> {
  try {
    switch (toolName) {
      case 'amap_search_poi': {
        const results = await searchPOI(apiKey, args.keywords as string, (args.city as string) ?? '云南');
        if (results.length === 0) return '未找到相关地点';
        return JSON.stringify(results.slice(0, 10));
      }
      case 'amap_get_weather': {
        const cityAdcodeMap: Record<string, string> = {
          '昆明': '530100', '大理': '532900', '丽江': '530700', '香格里拉': '533400',
          '西双版纳': '532800', '腾冲': '530500', '建水': '532500', '迪庆': '533400',
        };
        const city = args.city as string;
        const adcode = cityAdcodeMap[city] ?? city;
        const result = await getWeather(apiKey, adcode);
        if (!result) return `无法获取${city}的天气信息`;
        return JSON.stringify(result.forecasts);
      }
      case 'amap_geocode': {
        const result = await geocode(apiKey, args.address as string);
        if (!result) return '地址解析失败';
        return JSON.stringify(result);
      }
      case 'amap_route_matrix': {
        const origins = (args.origins as string[]) ?? [];
        const destinations = (args.destinations as string[]) ?? [];
        const mode = (args.mode as string) ?? 'driving';
        const typeCode = mode === 'walking' ? '3' : '1';
        const originsParam = origins.map((o) => o.split('|')[0]).join(';');
        const results: unknown[] = [];
        const failedDests: string[] = [];
        for (const dest of destinations) {
          const destCoord = dest.split('|')[0];
          const destName = dest.split('|')[1] ?? destCoord;
          try {
            const url = `https://restapi.amap.com/v3/distance?origins=${encodeURIComponent(originsParam)}&destination=${encodeURIComponent(destCoord)}&type=${typeCode}&key=${apiKey}`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await fetchJson<any>(url, undefined, { timeoutMs: 12000, retries: 2 });
            if (data.status === '1' && data.results) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data.results.forEach((r: any, i: number) => {
                const originName = (origins[i] ?? '').split('|')[1] ?? origins[i];
                results.push({
                  origin: origins[i]?.split('|')[0],
                  originName,
                  destination: destCoord,
                  destName,
                  distanceMeters: parseInt(r.distance ?? '0', 10),
                  durationSeconds: parseInt(r.duration ?? '0', 10),
                  durationMinutes: Math.round(parseInt(r.duration ?? '0', 10) / 60),
                  distanceKm: (parseInt(r.distance ?? '0', 10) / 1000).toFixed(1),
                  mode,
                });
              });
            } else {
              failedDests.push(destName);
            }
          } catch {
            failedDests.push(destName);
          }
        }
        return JSON.stringify({
          matrix: results,
          mode,
          ...(failedDests.length ? { partial: true, failedDestinations: failedDests } : {}),
        });
      }

      case 'amap_place_detail': {
        const poiId = args.poi_id as string;
        const url = `https://restapi.amap.com/v3/place/detail?id=${poiId}&key=${apiKey}&output=json`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await fetchJson<any>(url, undefined, { timeoutMs: 10000, retries: 2 });
        if (data.status !== '1' || !data.pois?.[0]) return '未找到景点详情';
        const poi = data.pois[0];
        return JSON.stringify({
          name: poi.name,
          address: poi.address,
          openingHours: poi.biz_ext?.open_time ?? poi.opentime_today ?? null,
          ticketPrice: poi.biz_ext?.cost ?? null,
          rating: poi.biz_ext?.rating ?? null,
          tel: poi.tel ?? null,
          type: poi.type ?? null,
        });
      }

      case 'web_search': {
        // Fallback: return empty results with a note
        // Full implementation requires ZhipuAI web_search or Serper API key
        const query = args.query as string;
        return JSON.stringify({
          results: [],
          note: `搜索"${query}"：请根据训练知识补充该景点信息，若信息不确定请在 notes 中注明"信息仅供参考，建议出发前核实"。`,
        });
      }

      default:
        return `未知工具: ${toolName}`;
    }
  } catch (e) {
    return `工具调用失败: ${e instanceof Error ? e.message : '未知错误'}`;
  }
}
