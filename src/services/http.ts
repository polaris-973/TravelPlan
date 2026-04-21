/**
 * fetchWithTimeout — a resilient fetch wrapper used for all Amap REST calls.
 *
 * Why it exists: on mobile Safari, a network blip will surface as the
 * opaque "Load failed" error and kill the whole agentic loop. We want
 * every network call to:
 *   - time out after N ms instead of hanging indefinitely
 *   - retry once on transient network errors (AbortError / TypeError)
 *   - return a meaningful error string rather than throwing on total failure
 */

export interface FetchRetryOptions {
  timeoutMs?: number;
  retries?: number;
  /** Called when a retry is about to happen (for progress log). */
  onRetry?: (attempt: number, err: Error) => void;
  /** Forward an abort signal (e.g. user cancellation). */
  signal?: AbortSignal;
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const { timeoutMs = 15000, retries = 1, onRetry, signal: userSignal } = opts;

  let lastErr: Error = new Error('Unknown fetch error');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

    // If caller provided an abort signal, forward cancellation to our controller
    const onUserAbort = () => controller.abort(userSignal?.reason);
    if (userSignal) userSignal.addEventListener('abort', onUserAbort);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
      if (!res.ok && res.status >= 500 && attempt < retries) {
        lastErr = new Error(`HTTP ${res.status}`);
        onRetry?.(attempt + 1, lastErr);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
      lastErr = err instanceof Error ? err : new Error(String(err));
      // User-initiated abort → propagate immediately
      if (userSignal?.aborted) throw lastErr;
      // Otherwise retry on network-style errors
      if (attempt < retries) {
        onRetry?.(attempt + 1, lastErr);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr;
}

/** Convenience: fetch + parse JSON with the same retry/timeout semantics. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
  opts?: FetchRetryOptions,
): Promise<T> {
  const res = await fetchWithTimeout(url, init, opts);
  return res.json() as Promise<T>;
}
