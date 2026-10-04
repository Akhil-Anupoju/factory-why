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

// Fetch-based streaming implementation using ReadableStream to allow Authorization headers
export function createInvestigationStream(incidentId: string, onEvent: OnSseEvent, onError?: OnSseError): StreamController {
  let controller = new AbortController();
  let running = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const base = (import.meta as any).env?.VITE_API_BASE_URL || '';
  const baseFixed = String(base).replace(/\/$/, '');
  const url = `${baseFixed}/api/incidents/${encodeURIComponent(incidentId)}/stream`.replace('//api', '/api');

  async function start() {
    if (running) return;
    running = true;
    controller = new AbortController();
    const headers: Record<string, string> = {};
    try {
      const token = await getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      onError?.(e);
    }

    try {
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal, credentials: 'same-origin' });
      if (!res.ok) {
        // Provide a structured error including HTTP status so callers can
        // distinguish authentication/authorization failures from network
        // errors and react accordingly.
        onError?.(new ApiError(`Stream HTTP error: ${res.status}`, res.status));
        running = false;
        return;
      }

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
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        // normal abort
      } else {
        onError?.(e);
      }
      running = false;
    }
  }

  function stop() {
    try {
      controller.abort();
    } catch (e) {
      // ignore
    }
    try {
      reader?.cancel();
    } catch (e) {
      // ignore
    }
    running = false;
  }

  return { start, stop, isRunning: () => running };
}

export default createInvestigationStream;
