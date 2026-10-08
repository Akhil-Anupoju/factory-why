/*
 * Lightweight EventSource wrapper for Factory WHY SSE investigation stream.
 * - Parses named events emitted by the backend
 * - Provides a small typed callback surface for React
 * - Does NOT attach credentials; callers must ensure same-origin or cookie auth as configured
 */
import { SseNamedEvent, SseEventName, SseEventPayload } from '../types';
import { getToken } from './tokenProvider';
import { ApiError } from './apiClient';

export type OnSseEvent = (ev: SseNamedEvent) => void;
export type OnSseError = (err: unknown) => void;

export interface StreamController {
  start: () => Promise<void>;
  stop: () => void;
  isRunning: () => boolean;
}

function safeParse(data: string): SseEventPayload | null {
  try {
    return JSON.parse(data) as SseEventPayload;
  } catch (e) {
    return null;
  }
}

// Small helpers and retry limits for robust client-side SSE handling.
const MAX_RECONNECT_ATTEMPTS = 3;
const MAX_AUTH_REFRESH_ATTEMPTS = 2; // attempt getToken(true) up to this many times on 401
const INITIAL_RECONNECT_DELAY_MS = 300;
function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// Fetch-based streaming implementation using ReadableStream to allow Authorization headers
export function createInvestigationStream(incidentId: string, onEvent: OnSseEvent, onError?: OnSseError): StreamController {
  let controller = new AbortController();
  let running = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  // Compute base url. In development prefer same-origin relative paths so the
  // Vite dev server proxy can forward requests to the backend and avoid CORS
  // preflight that would block Authorization headers. In production builds
  // use the explicit VITE_API_BASE_URL when provided.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env || {};
  const isDev = Boolean(env.DEV);
  const envBase = String(env?.VITE_API_BASE_URL || '');
  const baseFixed = isDev ? '' : envBase.replace(/\/$/, '');
  const url = `${baseFixed}/api/incidents/${encodeURIComponent(incidentId)}/stream`.replace('//api', '/api');

  async function start() {
    if (running) return;
    running = true;
    controller = new AbortController();
    let reconnectAttempts = 0;

    // Outer loop: attempt to connect/reconnect with backoff for transient
    // network/server issues. Exit when aborted or when a terminal error
    // occurs.
    while (!controller.signal.aborted) {
      // build fresh headers for each attempt to avoid stale tokens
      const headers: Record<string, string> = {};
      let token: string | null = null;
      try {
        token = await getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        // token retrieval errors are non-fatal here; surface to optional
        // error handler but continue to attempt an unauthenticated fetch.
        onError?.(e);
      }

      // optional safe debug logging for operators
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbg = Boolean((import.meta as any).env?.VITE_API_DEBUG === '1' || (import.meta as any).env?.VITE_API_DEBUG === 'true');
        if (dbg) {
          // only surface boolean/length info — never print token value
          // eslint-disable-next-line no-console
          console.info(`[SSE DEBUG] connect attempt=${reconnectAttempts} url=${url} tokenAvailable=${!!token} tokenLen=${token ? token.length : 0}`);
        }
      } catch (e) {
        // ignore debug failures
      }

      try {
        let res = await fetch(url, { method: 'GET', headers, signal: controller.signal, credentials: 'same-origin' });

        // If the server rejected the request due to auth, attempt to
        // refresh the token up to MAX_AUTH_REFRESH_ATTEMPTS times.
        if (!res.ok && res.status === 401) {
          let authAttempt = 0;
          while (authAttempt < MAX_AUTH_REFRESH_ATTEMPTS && !controller.signal.aborted) {
            authAttempt++;
            try {
              const refreshed = await getToken(true);
              if (refreshed) {
                headers['Authorization'] = `Bearer ${refreshed}`;
                const retry = await fetch(url, { method: 'GET', headers, signal: controller.signal, credentials: 'same-origin' });
                if (retry.ok) {
                  res = retry;
                  break;
                } else {
                  // keep the last response for handling below
                  res = retry;
                }
              } else {
                // no refreshed token available
                break;
              }
            } catch (e) {
              // ignore and continue attempts until limit
            }
          }
        }

        if (!res.ok) {
          // treat server-side transient errors as retryable with backoff
          if ((res.status >= 500 && res.status < 600) || [502, 503, 504].includes(res.status)) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !controller.signal.aborted) {
              const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts), 5000);
              reconnectAttempts++;
              await wait(delay);
              continue; // retry the outer connect loop
            }
          }

          onError?.(new ApiError(`Stream HTTP error: ${res.status}`, res.status));
          running = false;
          return;
        }

        // Successful connection; reset reconnect counter
        reconnectAttempts = 0;

        const stream = res.body;
        if (!stream) {
          onError?.(new Error('No response body for stream'));
          running = false;
          return;
        }

        reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // parse SSE frames: lines separated by \n\n
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            // parse raw frame
            const lines = raw.split(/\r?\n/);
            let eventName: string | null = null;
            let dataLines: string[] = [];
            for (const ln of lines) {
              if (ln.startsWith('event:')) {
                eventName = ln.replace(/^event:\s*/, '').trim();
              } else if (ln.startsWith('data:')) {
                dataLines.push(ln.replace(/^data:\s*/, ''));
              }
            }

            const dataText = dataLines.join('\n');
            const payload = safeParse(dataText) || { raw: dataText };

            const name = (eventName || 'message') as SseEventName;
            onEvent({ name: name as SseEventName, payload });
            if (name === 'awaiting_approval') {
              // stop after awaiting_approval
              stop();
              return;
            }
          }
        }

        running = false;
        return;
      } catch (e) {
        if ((e as any)?.name === 'AbortError') {
          // normal abort
          break;
        }

        // Network or stream error: attempt limited reconnects with backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && !controller.signal.aborted) {
          const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts), 5000);
          reconnectAttempts++;
          try {
            const p = reader?.cancel();
            if (p && typeof (p as any).catch === 'function') (p as Promise<any>).catch(() => {});
          } catch (err) {
            // ignore
          }
          await wait(delay);
          continue; // outer loop will try again
        }

        onError?.(e);
        running = false;
        return;
      }
    }

    // if we get here the controller has been aborted
    running = false;
  }

  function stop() {
    try {
      controller.abort();
    } catch (e) {
      // ignore
    }
    // reader.cancel() returns a promise; guard against rejected promise to
    // avoid unhandled rejection errors (some browsers surface AbortError
    // rejections from the underlying stream buffer). Attach a noop catch.
    try {
      const p = reader?.cancel();
      if (p && typeof (p as any).catch === 'function') {
        // swallow any rejection
        (p as Promise<any>).catch(() => {});
      }
    } catch (e) {
      // ignore synchronous errors
    }
    running = false;
  }

  return { start, stop, isRunning: () => running };
}

export default createInvestigationStream;
