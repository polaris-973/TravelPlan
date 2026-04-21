import type { WeatherInfo } from '../../types/trip';

// WMO weather code → Chinese condition label
const WMO_LABEL: Record<number, string> = {
  0: '晴', 1: '晴间多云', 2: '多云', 3: '阴',
  45: '雾', 48: '冻雾',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '冰粒',
  80: '阵雨', 81: '中阵雨', 82: '强阵雨',
  85: '阵雪', 86: '强阵雪',
  95: '雷雨', 96: '雷阵雨夹冰雹', 99: '强雷阵雨',
};

function wmoLabel(code: number): string {
  return WMO_LABEL[code] ?? (code < 50 ? '多云' : code < 70 ? '雨' : code < 80 ? '雪' : '阵雨');
}

function wmoCode(code: number): string {
  return String(code).padStart(3, '0');
}

export async function getDailyForecast(
  lat: number,
  lng: number,
  days = 7,
): Promise<WeatherInfo[]> {
  if (!lat || !lng || (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)) {
    throw new Error('地点坐标无效 (0,0)，请重新搜索该地点');
  }
  console.debug(`[Weather] 查询 lat=${lat.toFixed(4)} lng=${lng.toFixed(4)} days=${days}`);
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily: [
      'temperature_2m_max', 'temperature_2m_min',
      'precipitation_probability_max', 'precipitation_sum',
      'weathercode', 'windspeed_10m_max', 'uv_index_max',
    ].join(','),
    timezone: 'Asia/Shanghai',
    forecast_days: String(days),
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason ?? 'Open-Meteo 错误');

  const d = data.daily;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (d.time as string[]).map((date: string, i: number) => ({
    date,
    high: Math.round(d.temperature_2m_max[i] ?? 0),
    low: Math.round(d.temperature_2m_min[i] ?? 0),
    condition: wmoLabel(d.weathercode[i] ?? 0),
    conditionCode: wmoCode(d.weathercode[i] ?? 0),
    windSpeed: Math.round(d.windspeed_10m_max[i] ?? 0),
    humidity: undefined,
    uvIndex: Math.round(d.uv_index_max[i] ?? 0),
    rainfall: parseFloat((d.precipitation_sum[i] ?? 0).toFixed(1)),
    precipProbability: d.precipitation_probability_max[i] ?? undefined,
    iconCode: wmoCode(d.weathercode[i] ?? 0),
  }));
}

export async function getWeatherForDate(
  lat: number,
  lng: number,
  date: string,
): Promise<WeatherInfo | null> {
  const all = await getDailyForecast(lat, lng, 7);
  return all.find((w) => w.date === date) ?? all[0] ?? null;
}
