export type PlaceCategory =
  | 'nature'      // 自然景观
  | 'heritage'    // 人文古迹
  | 'food'        // 美食
  | 'hotel'       // 住宿
  | 'transport'   // 交通枢纽
  | 'shopping'    // 购物
  | 'activity';   // 活动体验

export type TransportMode = 'driving' | 'transit' | 'walking' | 'cycling' | 'flight' | 'highspeedrail';
export type Priority = 'must' | 'want' | 'maybe';
export type TripPace = 'relaxed' | 'balanced' | 'packed';
export type Interest = 'nature' | 'culture' | 'food' | 'photography' | 'adventure';
export type Budget = 'budget' | 'mid' | 'luxury';
export type NoteColor = 'yellow' | 'mint' | 'peach' | 'lavender';
export type NoteMood = '😊' | '🤩' | '😌' | '🤔' | '😴';

export interface Location {
  lng: number;
  lat: number;
  altitude?: number;
}

export interface PlaceNote {
  id: string;
  content: string;
  createdAt: string;
  color: NoteColor;
  mood?: NoteMood;
}

export interface PlaceVisit {
  id: string;
  placeId: string;
  name: string;
  location: Location;
  category: PlaceCategory;
  address?: string;
  arrivalTime?: string;
  departureTime?: string;
  durationMinutes: number;
  priority: Priority;
  notes: PlaceNote[];
  photos: string[];
  ticketRequired: boolean;
  ticketPrice?: number;
  rating?: number;
  openingHours?: string;
  tags?: string[];
  imageUrl?: string;
}

export interface RouteLeg {
  instruction: string;
  duration_s: number;
  distance_m: number;
}

export interface RouteSegment {
  fromPlaceId: string;
  toPlaceId: string;
  mode: TransportMode;
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  cost?: number;
  warnings: string[];
  legs?: RouteLeg[];
}

export interface TransportOption {
  mode: TransportMode;
  distance_m: number;
  duration_s: number;
  label: string;
}

export interface RouteMatrix {
  fromId: string;
  toId: string;
  options: TransportOption[];
  recommended: TransportMode;
  fetchedAt: string;
}

export interface WeatherInfo {
  date: string;
  high: number;
  low: number;
  condition: string;
  conditionCode: string;
  windSpeed?: number;
  humidity?: number;
  uvIndex?: number;
  rainfall?: number;
  precipProbability?: number;
  iconCode?: string;
}

export interface Day {
  id: string;
  date: string;
  places: PlaceVisit[];
  transportBetween: RouteSegment[];
  routeMatrix?: RouteMatrix[];
  notes: string;
  weather?: WeatherInfo;
}

export interface TripPreferences {
  pace: TripPace;
  interests: Interest[];
  budget: Budget;
  avoidAltitude: boolean;
}

export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  travelers: number;
  coverImage?: string;
  preferences: TripPreferences;
  days: Day[];
  hotels?: Hotel[];
  createdAt: string;
  updatedAt: string;

  // NEW: multi-plan support
  savedPlans?: SavedPlan[];
  activePlanId?: string;
}

export interface ItineraryPatch {
  type: 'add_place' | 'remove_place' | 'reorder' | 'update_notes' | 'change_day' | 'update_duration' | 'set_time' | 'apply_smart_plan';
  description: string;
  payload: Record<string, unknown>;
}

// ── 智能规划相关类型 ──────────────────────────────────────────────────────────

export type PlaceIndoorType = 'indoor' | 'outdoor' | 'mixed' | 'unknown';

export interface Hotel {
  id: string;
  name: string;
  location: Location;
  address?: string;
  checkInDate: string;
  checkOutDate: string;
  notes?: string;
  amapPoiId?: string;
}

export interface PlacePlanInput {
  placeId: string;
  name: string;
  location: Location;
  category: PlaceCategory;
  address?: string;
  amapPoiId?: string;
  indoorType: PlaceIndoorType;
  activities: string;
  durationMinutes: number;
  priority: Priority;
  openingHours?: string;
  closedDays?: string[];
  ticketPrice?: number;
  notes?: string;
}

export interface PlanningPreferences {
  startTime: string;
  endTime: string;
  lunchDurationMinutes: number;
  dinnerDurationMinutes: number;
  preferredTransport: TransportMode;
  avoidRainyOutdoor: boolean;
  maxDailyWalkMinutes: number;
  pace: TripPace;
}

export type PlanningStep =
  | 'select_places'
  | 'add_hotels'
  | 'set_activities'
  | 'preferences'
  | 'generating'
  | 'review'
  | 'done';

export interface PlanningSession {
  id: string;
  tripId: string;
  step: PlanningStep;
  places: PlacePlanInput[];
  hotels: Hotel[];
  preferences: PlanningPreferences;
  generatedPlan: SmartPlan | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedStop {
  type: 'hotel_depart' | 'place' | 'lunch' | 'dinner' | 'hotel_arrive' | 'transport';
  placeId?: string;
  hotelId?: string;
  name: string;
  location?: Location;
  arrivalTime: string;
  departureTime: string;
  durationMinutes: number;
  category?: PlaceCategory;
  indoorType?: PlaceIndoorType;
  notes?: string;
  weatherWarning?: string;
  transportToNext?: {
    mode: TransportMode;
    durationMinutes: number;
    distanceKm: number;
  };
}

export interface PlannedDay {
  dayIndex: number;
  date: string;
  hotelId: string;
  stops: PlannedStop[];
  weather?: WeatherInfo;
  totalDistanceKm: number;
  totalTravelMinutes: number;
  aiSummary: string;
}

export interface SmartPlan {
  id: string;
  sessionId: string;
  days: PlannedDay[];
  overallNotes: string;
  unscheduledPlaces?: Array<{ placeId: string; name: string; reason: string }>;
  recommendedReturnAirport?: RecommendedReturnAirport;
  generatedAt: string;
  llmModel: string;
}

// ── 航班 & 多方案 ────────────────────────────────────────────────────────────

export interface Airport {
  name: string;              // e.g. "昆明长水国际机场"
  code?: string;             // IATA, e.g. "KMG"
  city?: string;
  location?: Location;
}

export interface RecommendedReturnAirport {
  name: string;
  code?: string;
  city: string;
  distanceKm?: number;
  reason: string;
}

export interface TripIntake {
  arrivalAirport: Airport;
  arrivalDateTime: string;   // ISO
  returnDateTime: string;    // ISO
  preferredReturnCity?: string;

  adults: number;
  children: number;
  elderly: number;
  altitudeSensitive: boolean;

  interests: Interest[];
  budget: Budget;
  mustDoActivities: string;
  specialOccasion?: string;
  dietaryPrefs?: string;
  priorVisits?: string;

  pace: TripPace;
  preferredTransport: TransportMode;
  dailyStartTime: string;
  dailyEndTime: string;
  lunchDurationMinutes: number;
  dinnerDurationMinutes: number;
  avoidRainyOutdoor: boolean;

  fixedEvents?: Array<{ date: string; description: string }>;
  additionalNotes?: string;
}

export interface SavedPlan {
  id: string;
  tripId: string;
  name: string;
  intake: TripIntake;
  places: PlacePlanInput[];
  days: Day[];
  smartPlan: SmartPlan;
  recommendedReturnAirport?: RecommendedReturnAirport;
  createdAt: string;
  llmModel: string;
}
