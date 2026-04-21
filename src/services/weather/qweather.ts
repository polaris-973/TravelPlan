import type { WeatherInfo } from '../../types/trip';

const BASE = 'https://devapi.qweather.com/v7';

const ERROR_CODES: Record<string, string> = {
  '401': 'API Key 无效或未激活',
  '402': 'API Key 超出请求次数限制',
  '403': '无访问权限，请检查 Key 类型',
  '404': '查询地点不存在',
  '429': '请求过于频繁',
  '500': '和风天气服务异常',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDay(d: any, date: string): WeatherInfo {
  return {
    date,
    high: parseInt(d.tempMax ?? d.tempHigh ?? '0', 10),
    low: parseInt(d.tempMin ?? d.tempLow ?? '0', 10),
    condition: d.textDay ?? d.text ?? '',
    conditionCode: d.iconDay ?? d.icon ?? '',
    windSpeed: parseFloat(d.windSpeedDay ?? d.windSpeed ?? '0'),
    humidity: parseInt(d.humidity ?? '0', 10),
    uvIndex: parseInt(d.uvIndex ?? '0', 10),
    rainfall: parseFloat(d.precip ?? '0'),
    precipProbability: d.pop != null ? parseInt(d.pop, 10) : undefined,
    iconCode: d.iconDay ?? d.icon ?? '',
  };
}

export async function getDailyForecast(
  apiKey: string,
  lat: number,
  lng: number,
  days: 3 | 7 = 3,
): Promise<WeatherInfo[]> {
  const url = `${BASE}/weather/${days}d?location=${lng.toFixed(4)},${lat.toFixed(4)}&key=${apiKey}&lang=zh`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`网络请求失败: ${e instanceof Error ? e.message : '请检查网络连接'}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${ERROR_CODES[String(res.status)] ?? '请求失败'}`);
  }

  const data = await res.json();
  if (data.code !== '200') {
    const msg = ERROR_CODES[data.code] ?? `错误码 ${data.code}`;
    throw new Error(`QWeather: ${msg}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.daily as any[]).map((d) => parseDay(d, d.fxDate ?? ''));
}

export async function getWeatherForDate(
  apiKey: string,
  lat: number,
  lng: number,
  date: string,
): Promise<WeatherInfo | null> {
  const all = await getDailyForecast(apiKey, lat, lng, 3);
  return all.find((w) => w.date === date) ?? all[0] ?? null;
}
