import { create } from 'zustand';
import { storage } from '../services/storage';
import type { Trip, Day, PlaceVisit, PlaceCategory, PlaceNote, NoteColor, Hotel, WeatherInfo, SavedPlan } from '../types/trip';

function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function createDefaultTrip(): Trip {
  const now = new Date();
  const startDate = new Date(now.getTime() + 86400000 * 3);
  const endDate = new Date(startDate.getTime() + 86400000 * 6);
  return {
    id: nanoid(),
    title: '云南 7 日行程',
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    travelers: 2,
    preferences: { pace: 'balanced', interests: ['nature', 'culture'], budget: 'mid', avoidAltitude: false },
    days: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

// Migrate old userNotes: string → notes: PlaceNote[]
function migrateTrips(trips: Trip[]): Trip[] {
  return trips.map((trip) => ({
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      places: day.places.map((place) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = place as any;
        if (!Array.isArray(p.notes)) {
          const migrated: PlaceVisit = {
            ...place,
            notes: p.userNotes
              ? [{ id: nanoid(), content: p.userNotes, createdAt: new Date().toISOString(), color: 'yellow' as NoteColor }]
              : [],
          };
          return migrated;
        }
        return place;
      }),
    })),
  }));
}

interface DeletedItem {
  tripId: string;
  dayId: string;
  placeId: string;
  place: PlaceVisit;
  index: number;
}

interface TripState {
  trips: Trip[];
  activeTripId: string | null;
  pendingDelete: DeletedItem | null;
  getActiveTrip: () => Trip | null;
  setActiveTrip: (id: string) => void;
  createTrip: (partial?: Partial<Trip>) => Trip;
  updateTrip: (id: string, patch: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  addPlaceToDay: (tripId: string, dayId: string, place: Omit<PlaceVisit, 'id'>) => void;
  removePlace: (tripId: string, dayId: string, placeId: string) => void;
  undoDelete: () => void;
  reorderPlaces: (tripId: string, dayId: string, placeIds: string[]) => void;
  updatePlace: (tripId: string, dayId: string, placeId: string, patch: Partial<PlaceVisit>) => void;
  addDay: (tripId: string) => void;
  setDayWeather: (tripId: string, dayId: string, weather: WeatherInfo) => void;
  addNote: (tripId: string, dayId: string, placeId: string, note: Omit<PlaceNote, 'id' | 'createdAt'>) => void;
  removeNote: (tripId: string, dayId: string, placeId: string, noteId: string) => void;
  updateNote: (tripId: string, dayId: string, placeId: string, noteId: string, patch: Partial<PlaceNote>) => void;
  addHotel: (tripId: string, hotel: Hotel) => void;
  removeHotel: (tripId: string, hotelId: string) => void;
  updateHotel: (tripId: string, hotelId: string, patch: Partial<Hotel>) => void;
  applySmartPlan: (tripId: string, days: Day[]) => void;

  // Multi-plan management
  savePlan: (tripId: string, plan: SavedPlan) => void;
  setActivePlan: (tripId: string, planId: string) => void;
  renamePlan: (tripId: string, planId: string, name: string) => void;
  deletePlan: (tripId: string, planId: string) => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: migrateTrips(storage.getTrips()),
  activeTripId: storage.getActiveTripId(),
  pendingDelete: null,

  getActiveTrip() {
    const { trips, activeTripId } = get();
    return trips.find((t) => t.id === activeTripId) ?? null;
  },

  setActiveTrip(id) {
    set({ activeTripId: id });
    storage.setActiveTripId(id);
  },

  createTrip(partial = {}) {
    const trip: Trip = { ...createDefaultTrip(), ...partial, id: nanoid() };
    set((s) => {
      const trips = [trip, ...s.trips];
      storage.saveTrips(trips);
      storage.setActiveTripId(trip.id);
      return { trips, activeTripId: trip.id };
    });
    return trip;
  },

  updateTrip(id, patch) {
    set((s) => {
      const trips = s.trips.map((t) => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t);
      storage.saveTrips(trips);
      return { trips };
    });
  },

  deleteTrip(id) {
    set((s) => {
      const trips = s.trips.filter((t) => t.id !== id);
      storage.saveTrips(trips);
      const activeTripId = s.activeTripId === id ? (trips[0]?.id ?? null) : s.activeTripId;
      storage.setActiveTripId(activeTripId);
      return { trips, activeTripId };
    });
  },

  addPlaceToDay(tripId, dayId, place) {
    const id = nanoid();
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          return { ...d, places: [...d.places, { ...place, id, notes: place.notes ?? [] }] };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  removePlace(tripId, dayId, placeId) {
    set((s) => {
      let deleted: DeletedItem | null = null;
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          const idx = d.places.findIndex((p) => p.id === placeId);
          if (idx >= 0) {
            deleted = { tripId, dayId, placeId, place: d.places[idx], index: idx };
          }
          return { ...d, places: d.places.filter((p) => p.id !== placeId) };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips, pendingDelete: deleted };
    });
    setTimeout(() => set((s) => s.pendingDelete?.placeId === placeId ? { pendingDelete: null } : s), 3000);
  },

  undoDelete() {
    const { pendingDelete } = get();
    if (!pendingDelete) return;
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== pendingDelete.tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== pendingDelete.dayId) return d;
          const places = [...d.places];
          places.splice(pendingDelete.index, 0, pendingDelete.place);
          return { ...d, places };
        });
        return { ...t, days };
      });
      storage.saveTrips(trips);
      return { trips, pendingDelete: null };
    });
  },

  reorderPlaces(tripId, dayId, placeIds) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          const placeMap = new Map(d.places.map((p) => [p.id, p]));
          const places = placeIds.map((id) => placeMap.get(id)).filter(Boolean) as PlaceVisit[];
          return { ...d, places };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  updatePlace(tripId, dayId, placeId, patch) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          return { ...d, places: d.places.map((p) => p.id === placeId ? { ...p, ...patch } : p) };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  addDay(tripId) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const lastDay = t.days[t.days.length - 1];
        const nextDate = lastDay
          ? new Date(new Date(lastDay.date).getTime() + 86400000).toISOString().split('T')[0]
          : t.startDate;
        const newDay: Day = { id: nanoid(), date: nextDate, places: [], transportBetween: [], notes: '' };
        return { ...t, days: [...t.days, newDay], updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  setDayWeather(tripId, dayId, weather) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => d.id === dayId ? { ...d, weather } : d);
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  addNote(tripId, dayId, placeId, note) {
    const id = nanoid();
    const createdAt = new Date().toISOString();
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            places: d.places.map((p) =>
              p.id === placeId ? { ...p, notes: [...(p.notes ?? []), { ...note, id, createdAt }] } : p
            ),
          };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  removeNote(tripId, dayId, placeId, noteId) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            places: d.places.map((p) =>
              p.id === placeId ? { ...p, notes: (p.notes ?? []).filter((n) => n.id !== noteId) } : p
            ),
          };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  updateNote(tripId, dayId, placeId, noteId, patch) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days.map((d) => {
          if (d.id !== dayId) return d;
          return {
            ...d,
            places: d.places.map((p) =>
              p.id === placeId
                ? { ...p, notes: (p.notes ?? []).map((n) => n.id === noteId ? { ...n, ...patch } : n) }
                : p
            ),
          };
        });
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  addHotel(tripId, hotel) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        return { ...t, hotels: [...(t.hotels ?? []), hotel], updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  removeHotel(tripId, hotelId) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        return { ...t, hotels: (t.hotels ?? []).filter((h) => h.id !== hotelId), updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  updateHotel(tripId, hotelId, patch) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        return { ...t, hotels: (t.hotels ?? []).map((h) => h.id === hotelId ? { ...h, ...patch } : h), updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  applySmartPlan(tripId, days) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        return { ...t, days, updatedAt: new Date().toISOString() };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  savePlan(tripId, plan) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const savedPlans = [...(t.savedPlans ?? []), plan];
        return {
          ...t,
          savedPlans,
          activePlanId: plan.id,
          days: plan.days, // active plan mirrors into trip.days for rendering
          updatedAt: new Date().toISOString(),
        };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  setActivePlan(tripId, planId) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const plan = (t.savedPlans ?? []).find((p) => p.id === planId);
        if (!plan) return t;
        return {
          ...t,
          activePlanId: planId,
          days: plan.days,
          updatedAt: new Date().toISOString(),
        };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  renamePlan(tripId, planId, name) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          savedPlans: (t.savedPlans ?? []).map((p) => p.id === planId ? { ...p, name } : p),
          updatedAt: new Date().toISOString(),
        };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },

  deletePlan(tripId, planId) {
    set((s) => {
      const trips = s.trips.map((t) => {
        if (t.id !== tripId) return t;
        const remaining = (t.savedPlans ?? []).filter((p) => p.id !== planId);
        let nextActive = t.activePlanId;
        let nextDays = t.days;
        if (t.activePlanId === planId) {
          const fallback = remaining[remaining.length - 1];
          nextActive = fallback?.id;
          nextDays = fallback?.days ?? [];
        }
        return {
          ...t,
          savedPlans: remaining,
          activePlanId: nextActive,
          days: nextDays,
          updatedAt: new Date().toISOString(),
        };
      });
      storage.saveTrips(trips);
      return { trips };
    });
  },
}));

export function categoryFromType(type: string): PlaceCategory {
  if (/景区|公园|山|湖|洱海|雪山|溶洞/.test(type)) return 'nature';
  if (/古城|寺庙|博物馆|古迹|历史/.test(type)) return 'heritage';
  if (/餐厅|美食|小吃|咖啡/.test(type)) return 'food';
  if (/酒店|民宿|客栈|旅馆/.test(type)) return 'hotel';
  if (/火车站|机场|客运|汽车站/.test(type)) return 'transport';
  if (/购物|超市|商场/.test(type)) return 'shopping';
  return 'activity';
}
