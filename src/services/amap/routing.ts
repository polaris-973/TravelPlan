import type { Location, TransportOption, TransportMode } from '../../types/trip';

const BASE = 'https://restapi.amap.com';

function formatLoc(loc: Location) {
  return `${loc.lng.toFixed(6)},${loc.lat.toFixed(6)}`;
}

function formatLabel(distance_m: number, duration_s: number): string {
  const km = (distance_m / 1000).toFixed(1);
  const min = Math.round(duration_s / 60);
  return `${km}公里 · ${min}分钟`;
}

async function fetchWalking(apiKey: string, from: Location, to: Location): Promise<TransportOption | null> {
  try {
    const url = `${BASE}/v3/direction/walking?origin=${formatLoc(from)}&destination=${formatLoc(to)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1' || !data.route?.paths?.[0]) return null;
    const p = data.route.paths[0];
    const distance_m = parseInt(p.distance, 10);
    const duration_s = parseInt(p.duration, 10);
    return { mode: 'walking', distance_m, duration_s, label: formatLabel(distance_m, duration_s) };
  } catch { return null; }
}

async function fetchDriving(apiKey: string, from: Location, to: Location): Promise<TransportOption | null> {
  try {
    const url = `${BASE}/v3/direction/driving?origin=${formatLoc(from)}&destination=${formatLoc(to)}&key=${apiKey}&strategy=0`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1' || !data.route?.paths?.[0]) return null;
    const p = data.route.paths[0];
    const distance_m = parseInt(p.distance, 10);
    const duration_s = parseInt(p.duration, 10);
    return { mode: 'driving', distance_m, duration_s, label: formatLabel(distance_m, duration_s) };
  } catch { return null; }
}

async function fetchCycling(apiKey: string, from: Location, to: Location): Promise<TransportOption | null> {
  try {
    const url = `${BASE}/v4/direction/bicycling?origin=${formatLoc(from)}&destination=${formatLoc(to)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.errcode !== 0 || !data.data?.paths?.[0]) return null;
    const p = data.data.paths[0];
    const distance_m = parseInt(p.distance, 10);
    const duration_s = parseInt(p.duration, 10);
    return { mode: 'cycling', distance_m, duration_s, label: formatLabel(distance_m, duration_s) };
  } catch { return null; }
}

async function fetchTransit(apiKey: string, from: Location, to: Location): Promise<TransportOption | null> {
  try {
    const url = `${BASE}/v3/direction/transit/integrated?origin=${formatLoc(from)}&destination=${formatLoc(to)}&city=云南&cityd=云南&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '1' || !data.route?.transits?.[0]) return null;
    const t = data.route.transits[0];
    const distance_m = parseInt(data.route.distance ?? '0', 10);
    const duration_s = parseInt(t.duration ?? '0', 10);
    return { mode: 'transit', distance_m, duration_s, label: formatLabel(distance_m, duration_s) };
  } catch { return null; }
}

export function pickRecommended(options: TransportOption[]): TransportMode {
  const walk = options.find((o) => o.mode === 'walking');
  if (walk && walk.distance_m < 2500) return 'walking';
  const cycle = options.find((o) => o.mode === 'cycling');
  if (cycle && cycle.distance_m < 8000) return 'cycling';
  return 'driving';
}

export async function getRouteOptions(
  apiKey: string,
  from: Location,
  to: Location,
): Promise<TransportOption[]> {
  const [walk, drive, cycle, transit] = await Promise.all([
    fetchWalking(apiKey, from, to),
    fetchDriving(apiKey, from, to),
    fetchCycling(apiKey, from, to),
    fetchTransit(apiKey, from, to),
  ]);
  return [walk, cycle, drive, transit].filter(Boolean) as TransportOption[];
}
