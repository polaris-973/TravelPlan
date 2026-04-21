/**
 * 方案分享 — 压缩 SavedPlan → URL hash，接收方只读打开。
 *
 * Flow:
 *  encode:  SavedPlan + tripTitle  → JSON → gzip(CompressionStream) → base64url
 *  decode:  base64url → gunzip → JSON → { trip_title, plan }
 *
 * URL: <origin>/#view=<base64url>
 * 选用 hash 而非 query，因为 hash 不发给服务器、体积更宽裕、在静态 PWA 上解析更快。
 */

import type { SavedPlan } from '../types/trip';

export interface SharePayload {
  tripTitle: string;
  plan: SavedPlan;
  sharedAt: string;
  appVersion: string;
}

const APP_VERSION = '1.0.0';

// ── base64url helpers ───────────────────────────────────────────────────────
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── gzip via CompressionStream ──────────────────────────────────────────────
async function compress(text: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(text);
  const stream = new Blob([new Uint8Array(input)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function decompress(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

// ── public API ──────────────────────────────────────────────────────────────
export async function encodePlanForShare(plan: SavedPlan, tripTitle: string): Promise<string> {
  const payload: SharePayload = {
    tripTitle,
    plan,
    sharedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  };
  const compressed = await compress(JSON.stringify(payload));
  return bytesToBase64Url(compressed);
}

export async function decodePlanFromHash(encoded: string): Promise<SharePayload | null> {
  try {
    const bytes = base64UrlToBytes(encoded);
    const json = await decompress(bytes);
    const parsed = JSON.parse(json) as SharePayload;
    if (!parsed.plan || !parsed.plan.days) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(encoded: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#view=${encoded}`;
}

export function getShareHashValue(): string | null {
  const h = window.location.hash;
  if (h.startsWith('#view=')) return h.slice('#view='.length);
  return null;
}
