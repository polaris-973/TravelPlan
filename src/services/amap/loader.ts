import { fetchJson } from '../http';

declare global {
  interface Window {
    AMap: AMapType;
    _AMapSecurityConfig?: { securityJsCode?: string; serviceHost?: string };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AMapType = any;

let loadPromise: Promise<AMapType> | null = null;

export function loadAMap(apiKey: string, version = '2.0'): Promise<AMapType> {
  if (loadPromise) return loadPromise;
  if (window.AMap) return Promise.resolve(window.AMap);

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=${version}&key=${apiKey}&callback=__amapCallback&plugin=AMap.Geocoder,AMap.PlacesSearch,AMap.Driving,AMap.Walking,AMap.Riding,AMap.Transfer,AMap.Weather,AMap.DistrictSearch,AMap.Geolocation,AMap.ToolBar`;
    script.async = true;
    script.onerror = () => reject(new Error('高德地图加载失败'));
    const w = window as unknown as Record<string, unknown>;
    w['__amapCallback'] = () => {
      resolve(window.AMap);
      delete w['__amapCallback'];
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function geocode(apiKey: string, address: string): Promise<{ lng: number; lat: number } | null> {
  const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&key=${apiKey}&output=json`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchJson<any>(url, undefined, { timeoutMs: 10000, retries: 2 });
    if (data.status === '1' && data.geocodes?.length > 0) {
      const [lng, lat] = data.geocodes[0].location.split(',').map(Number);
      return { lng, lat };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function searchPOI(apiKey: string, keywords: string, city = '云南'): Promise<PoiResult[]> {
  const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&key=${apiKey}&output=json&offset=20`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchJson<any>(url, undefined, { timeoutMs: 10000, retries: 2 });
    if (data.status === '1' && data.pois) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return data.pois.map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        address: p.address as string,
        location: {
          lng: parseFloat((p.location as string)?.split(',')?.[0] ?? '0'),
          lat: parseFloat((p.location as string)?.split(',')?.[1] ?? '0'),
        },
        type: p.type as string,
        rating: parseFloat(p.biz_ext?.rating ?? '0'),
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

export interface PoiResult {
  id: string;
  name: string;
  address: string;
  location: { lng: number; lat: number };
  type: string;
  rating: number;
}

export async function getWeather(apiKey: string, adcode: string): Promise<WeatherResult | null> {
  const url = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${apiKey}&extensions=all&output=json`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchJson<any>(url, undefined, { timeoutMs: 10000, retries: 2 });
    if (data.status === '1' && data.forecasts?.length > 0) {
      return { forecasts: data.forecasts[0].casts };
    }
  } catch {
    // ignore
  }
  return null;
}

export interface WeatherResult {
  forecasts: Array<{
    date: string;
    week: string;
    dayweather: string;
    nightweather: string;
    daytemp: string;
    nighttemp: string;
    daywind: string;
    daypower: string;
  }>;
}
