import type { Trip, SavedPlan, TripIntake, SmartPlan } from '../types/trip';
import type { LLMConfig } from '../types/llm';

const STORAGE_KEY_TRIPS = 'travelplan_trips';
const STORAGE_KEY_CONFIG = 'travelplan_config';
const STORAGE_KEY_ACTIVE_TRIP = 'travelplan_active_trip';

function getStorage(): Storage {
  return window.localStorage;
}

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Wrap any legacy trip.days into a single SavedPlan named "原始方案"
export function migrateTripToSavedPlans(trip: Trip): Trip {
  if (trip.savedPlans && trip.savedPlans.length > 0) return trip;

  if (!trip.days || trip.days.length === 0) {
    return { ...trip, savedPlans: [] };
  }

  const placeholderIntake: TripIntake = {
    arrivalAirport: { name: '' },
    arrivalDateTime: trip.startDate ? `${trip.startDate}T09:00:00` : new Date().toISOString(),
    returnDateTime: trip.endDate ? `${trip.endDate}T18:00:00` : new Date().toISOString(),
    adults: trip.travelers ?? 2,
    children: 0,
    elderly: 0,
    altitudeSensitive: trip.preferences?.avoidAltitude ?? false,
    interests: trip.preferences?.interests ?? [],
    budget: trip.preferences?.budget ?? 'mid',
    mustDoActivities: '',
    pace: trip.preferences?.pace ?? 'balanced',
    preferredTransport: 'driving',
    dailyStartTime: '09:00',
    dailyEndTime: '20:00',
    lunchDurationMinutes: 75,
    dinnerDurationMinutes: 75,
    avoidRainyOutdoor: true,
  };

  const placeholderSmartPlan: SmartPlan = {
    id: nanoid(),
    sessionId: 'legacy',
    days: [],
    overallNotes: '由旧版行程自动迁移',
    generatedAt: trip.createdAt ?? new Date().toISOString(),
    llmModel: 'legacy',
  };

  const plan: SavedPlan = {
    id: nanoid(),
    tripId: trip.id,
    name: '原始方案',
    intake: placeholderIntake,
    places: [],
    days: trip.days,
    smartPlan: placeholderSmartPlan,
    createdAt: trip.createdAt ?? new Date().toISOString(),
    llmModel: 'legacy',
  };

  return { ...trip, savedPlans: [plan], activePlanId: plan.id };
}

export const storage = {
  getTrips(): Trip[] {
    try {
      const raw = getStorage().getItem(STORAGE_KEY_TRIPS);
      const list: Trip[] = raw ? JSON.parse(raw) : [];
      return list.map(migrateTripToSavedPlans);
    } catch {
      return [];
    }
  },

  saveTrips(trips: Trip[]): void {
    getStorage().setItem(STORAGE_KEY_TRIPS, JSON.stringify(trips));
  },

  getTrip(id: string): Trip | null {
    return this.getTrips().find((t) => t.id === id) ?? null;
  },

  saveTrip(trip: Trip): void {
    const trips = this.getTrips();
    const idx = trips.findIndex((t) => t.id === trip.id);
    if (idx >= 0) trips[idx] = trip;
    else trips.unshift(trip);
    this.saveTrips(trips);
  },

  deleteTrip(id: string): void {
    this.saveTrips(this.getTrips().filter((t) => t.id !== id));
  },

  getConfig(): Partial<LLMConfig> {
    try {
      const raw = getStorage().getItem(STORAGE_KEY_CONFIG);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  saveConfig(config: Partial<LLMConfig>): void {
    getStorage().setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  },

  getActiveTripId(): string | null {
    return getStorage().getItem(STORAGE_KEY_ACTIVE_TRIP);
  },

  setActiveTripId(id: string | null): void {
    if (id) getStorage().setItem(STORAGE_KEY_ACTIVE_TRIP, id);
    else getStorage().removeItem(STORAGE_KEY_ACTIVE_TRIP);
  },

  /** Export all trips as a JSON-serializable snapshot (for manual backup). */
  exportSnapshot(): { version: number; exportedAt: string; trips: Trip[] } {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      trips: this.getTrips(),
    };
  },

  /**
   * Import a snapshot. Mode:
   *   'merge'    — keep existing trips; add imported ones whose id is new, overwrite same-id
   *   'replace'  — discard existing trips entirely
   */
  importSnapshot(snap: { trips: Trip[] }, mode: 'merge' | 'replace' = 'merge'): { added: number; updated: number; total: number } {
    if (!Array.isArray(snap.trips)) throw new Error('备份文件格式错误');
    const incoming = snap.trips.map(migrateTripToSavedPlans);

    if (mode === 'replace') {
      this.saveTrips(incoming);
      return { added: incoming.length, updated: 0, total: incoming.length };
    }

    const existing = this.getTrips();
    const byId = new Map(existing.map((t) => [t.id, t]));
    let added = 0, updated = 0;
    for (const t of incoming) {
      if (byId.has(t.id)) { byId.set(t.id, t); updated++; }
      else { byId.set(t.id, t); added++; }
    }
    const merged = Array.from(byId.values());
    this.saveTrips(merged);
    return { added, updated, total: merged.length };
  },
};
