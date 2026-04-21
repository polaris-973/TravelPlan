/**
 * SmartPlan 结构化输出解析器
 *
 * LLM 调用 propose_smart_plan 工具后，原始参数经此层校验、补全、转换
 * 最终输出可直接写入 tripStore 的数据结构。
 */

import type {
  SmartPlan, PlannedDay, PlannedStop, PlaceIndoorType,
  PlacePlanInput, Hotel, Day, PlaceVisit, PlaceNote,
  RecommendedReturnAirport, RouteSegment,
} from '../../types/trip';

// ─────────────────────────────────────────────────────────────────────────────
// 1. LLM 原始输出类型（宽松，允许字段缺失）
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawStop = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawDay = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawPlan = Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// 2. 解析 LLM 原始输出 → SmartPlan
// ─────────────────────────────────────────────────────────────────────────────

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function parseTime(t: unknown): string {
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t.trim())) {
    const [h, m] = t.trim().split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  return '09:00';
}

function parseStop(raw: RawStop, index: number, places: PlacePlanInput[], hotels: Hotel[]): PlannedStop {
  const type = raw.type ?? (raw.stop_type ?? 'place');

  // Resolve location from places/hotels if not provided
  let location = raw.location ?? undefined;
  if (!location && raw.place_id) {
    const p = places.find((pl) => pl.placeId === raw.place_id);
    if (p) location = p.location;
  }
  if (!location && raw.hotel_id) {
    const h = hotels.find((ho) => ho.id === raw.hotel_id);
    if (h) location = h.location;
  }

  const arrivalTime = parseTime(raw.arrival_time ?? raw.arrivalTime);
  const departureTime = parseTime(raw.departure_time ?? raw.departureTime);
  const durationMinutes = typeof raw.duration_minutes === 'number'
    ? raw.duration_minutes
    : (typeof raw.durationMinutes === 'number' ? raw.durationMinutes : 60);

  const transportToNext = raw.transport_to_next ?? raw.transportToNext;

  return {
    type,
    placeId: raw.place_id ?? raw.placeId ?? undefined,
    hotelId: raw.hotel_id ?? raw.hotelId ?? undefined,
    name: raw.name ?? `行程站 ${index + 1}`,
    location,
    arrivalTime,
    departureTime,
    durationMinutes,
    category: raw.category ?? undefined,
    indoorType: (raw.indoor_type ?? raw.indoorType) as PlaceIndoorType | undefined,
    notes: raw.notes ?? undefined,
    weatherWarning: raw.weather_warning ?? raw.weatherWarning ?? undefined,
    transportToNext: transportToNext ? {
      mode: transportToNext.mode ?? 'driving',
      durationMinutes: transportToNext.duration_minutes ?? transportToNext.durationMinutes ?? 0,
      distanceKm: transportToNext.distance_km ?? transportToNext.distanceKm ?? 0,
    } : undefined,
  };
}

function parseDay(raw: RawDay, places: PlacePlanInput[], hotels: Hotel[]): PlannedDay {
  const stops: PlannedStop[] = Array.isArray(raw.stops)
    ? raw.stops.map((s: RawStop, i: number) => parseStop(s, i, places, hotels))
    : [];

  // Insert hotel_depart / hotel_arrive bookends if the LLM omitted them,
  // rather than overwriting existing tourist places.
  const dayHotelId = raw.hotel_id ?? raw.hotelId ?? undefined;
  const dayHotel = hotels.find((h) => h.id === dayHotelId);

  if (stops.length === 0 || stops[0].type !== 'hotel_depart') {
    stops.unshift({
      type: 'hotel_depart',
      hotelId: dayHotel?.id,
      name: dayHotel ? `${dayHotel.name}出发` : '酒店出发',
      location: dayHotel?.location,
      arrivalTime: raw.start_time ?? raw.startTime ?? '09:00',
      departureTime: raw.start_time ?? raw.startTime ?? '09:00',
      durationMinutes: 0,
    });
  }
  if (stops.length === 0 || stops[stops.length - 1].type !== 'hotel_arrive') {
    const lastStop = stops[stops.length - 1];
    const returnTime = lastStop?.departureTime ?? '20:00';
    stops.push({
      type: 'hotel_arrive',
      hotelId: dayHotel?.id,
      name: dayHotel ? `返回${dayHotel.name}` : '返回酒店',
      location: dayHotel?.location,
      arrivalTime: returnTime,
      departureTime: returnTime,
      durationMinutes: 0,
    });
  }

  return {
    dayIndex: typeof raw.day_index === 'number' ? raw.day_index : 0,
    date: raw.date ?? '',
    hotelId: raw.hotel_id ?? raw.hotelId ?? (hotels[0]?.id ?? ''),
    stops,
    totalDistanceKm: raw.total_distance_km ?? raw.totalDistanceKm ?? 0,
    totalTravelMinutes: raw.total_travel_minutes ?? raw.totalTravelMinutes ?? 0,
    aiSummary: raw.ai_summary ?? raw.aiSummary ?? '',
  };
}

export function parseSmartPlan(
  raw: RawPlan,
  sessionId: string,
  places: PlacePlanInput[],
  hotels: Hotel[],
  llmModel: string,
): SmartPlan {
  if (!raw || typeof raw !== 'object') {
    throw new Error('LLM 返回的规划数据格式错误');
  }

  const rawDays: RawDay[] = Array.isArray(raw.days) ? raw.days : [];
  if (rawDays.length === 0) {
    throw new Error('LLM 未生成任何天数的日程，请重新规划');
  }

  const days: PlannedDay[] = rawDays.map((d, i) => {
    const parsed = parseDay(d, places, hotels);
    parsed.dayIndex = i;
    return parsed;
  });

  const rawAirport = raw.recommended_return_airport ?? raw.recommendedReturnAirport;
  const recommendedReturnAirport: RecommendedReturnAirport | undefined = rawAirport && typeof rawAirport === 'object'
    ? {
        name: String(rawAirport.name ?? ''),
        code: rawAirport.code ? String(rawAirport.code) : undefined,
        city: String(rawAirport.city ?? ''),
        distanceKm: typeof rawAirport.distance_km === 'number'
          ? rawAirport.distance_km
          : (typeof rawAirport.distanceKm === 'number' ? rawAirport.distanceKm : undefined),
        reason: String(rawAirport.reason ?? ''),
      }
    : undefined;

  return {
    id: nanoid(),
    sessionId,
    days,
    overallNotes: raw.summary ?? raw.overallNotes ?? '',
    unscheduledPlaces: Array.isArray(raw.unscheduled_places)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? raw.unscheduled_places.map((p: any) => ({
          placeId: p.place_id ?? p.placeId ?? '',
          name: p.name ?? '',
          reason: p.reason ?? '',
        }))
      : [],
    recommendedReturnAirport,
    generatedAt: new Date().toISOString(),
    llmModel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SmartPlan → tripStore 格式（Day[] + PlaceVisit[]）
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplyPlanResult {
  days: Day[];
}

export function smartPlanToTripDays(
  plan: SmartPlan,
  places: PlacePlanInput[],
): ApplyPlanResult {
  const placeMap = new Map(places.map((p) => [p.placeId, p]));

  const days: Day[] = plan.days.map((planDay) => {
    // Map each 'place' stop → a PlaceVisit, remembering its index in planDay.stops
    // so we can pull transport_to_next from the same stop into the following segment.
    const placeStopIndices: number[] = [];
    const placeVisits: PlaceVisit[] = [];

    planDay.stops.forEach((stop, idx) => {
      // Surface sightseeing places AND transport hubs (train stations/airports) as PlaceVisit
      const isPlace = stop.type === 'place' && !!stop.placeId;
      const isTransport = stop.type === 'transport' && !!stop.location;
      if (!isPlace && !isTransport) return;

      const source = stop.placeId ? placeMap.get(stop.placeId) : undefined;
      const arrivalISO = stop.arrivalTime
        ? `${planDay.date}T${stop.arrivalTime}:00`
        : undefined;
      const departureISO = stop.departureTime
        ? `${planDay.date}T${stop.departureTime}:00`
        : undefined;

      const notes: PlaceNote[] = [];
      if (stop.notes) {
        notes.push({
          id: nanoid(),
          content: stop.notes,
          createdAt: new Date().toISOString(),
          color: 'yellow',
        });
      }
      if (stop.weatherWarning) {
        notes.push({
          id: nanoid(),
          content: `⚠️ ${stop.weatherWarning}`,
          createdAt: new Date().toISOString(),
          color: 'peach',
        });
      }

      // Choose sensible category: transport hubs → 'transport' (🚆/✈️ icon on map)
      const category = isTransport
        ? 'transport'
        : (stop.category ?? source?.category ?? 'activity');

      placeVisits.push({
        id: nanoid(),
        placeId: stop.placeId ?? `__transport_${planDay.date}_${idx}`,
        name: stop.name,
        location: stop.location ?? source?.location ?? { lat: 0, lng: 0 },
        category,
        address: source?.address,
        arrivalTime: arrivalISO,
        departureTime: departureISO,
        durationMinutes: stop.durationMinutes,
        priority: source?.priority ?? 'maybe',
        notes,
        photos: [],
        ticketRequired: (source?.ticketPrice ?? 0) > 0,
        ticketPrice: source?.ticketPrice,
        rating: undefined,
        openingHours: source?.openingHours,
      });
      placeStopIndices.push(idx);
    });

    // Build transport segments between consecutive place-stops using the LLM's
    // transport_to_next data (which attaches to the departing stop).
    const segments: RouteSegment[] = [];
    for (let i = 0; i < placeVisits.length - 1; i++) {
      const fromStop = planDay.stops[placeStopIndices[i]];
      const toVisit = placeVisits[i + 1];
      const fromVisit = placeVisits[i];
      // Sum transport over any intermediate meal/hotel stops (LLM may insert lunch between places)
      let durationMinutes = 0;
      let distanceKm = 0;
      let mode = fromStop.transportToNext?.mode ?? 'driving';
      for (let j = placeStopIndices[i]; j < placeStopIndices[i + 1]; j++) {
        const t = planDay.stops[j].transportToNext;
        if (t) {
          durationMinutes += t.durationMinutes ?? 0;
          distanceKm += t.distanceKm ?? 0;
          // prefer the mode of the first segment after the source place
          if (j === placeStopIndices[i]) mode = t.mode ?? mode;
        }
      }
      if (durationMinutes > 0 || distanceKm > 0) {
        segments.push({
          fromPlaceId: fromVisit.placeId,
          toPlaceId: toVisit.placeId,
          mode,
          distanceMeters: Math.round(distanceKm * 1000),
          durationSeconds: Math.round(durationMinutes * 60),
          warnings: [],
        });
      }
    }

    const day: Day = {
      id: nanoid(),
      date: planDay.date,
      places: placeVisits,
      transportBetween: segments,
      notes: planDay.aiSummary,
    };

    return day;
  });

  return { days };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 校验辅助：检查方案是否完整
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateSmartPlan(plan: SmartPlan, places: PlacePlanInput[]): PlanValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const mustPlaceIds = new Set(
    places.filter((p) => p.priority === 'must').map((p) => p.placeId),
  );

  const scheduledPlaceIds = new Set(
    plan.days.flatMap((d) => d.stops.filter((s) => s.type === 'place').map((s) => s.placeId ?? '')),
  );

  for (const id of mustPlaceIds) {
    if (!scheduledPlaceIds.has(id)) {
      const p = places.find((pl) => pl.placeId === id);
      errors.push(`必去景点"${p?.name ?? id}"未被安排`);
    }
  }

  for (const day of plan.days) {
    if (!day.date) errors.push(`第 ${day.dayIndex + 1} 天缺少日期`);
    if (day.stops.length < 2) warnings.push(`第 ${day.dayIndex + 1} 天（${day.date}）安排的景点较少`);

    for (const stop of day.stops) {
      if (stop.type === 'place') {
        if (!stop.arrivalTime || !stop.departureTime) {
          warnings.push(`${day.date} 中"${stop.name}"缺少到达/离开时间`);
        }
        if (!stop.location) {
          warnings.push(`${day.date} 中"${stop.name}"缺少坐标`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
