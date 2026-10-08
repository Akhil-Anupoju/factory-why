import { vi } from 'vitest';

// Mock tokenProvider before importing the stream implementation so the
// stream can call getToken/getToken(true) and our test can control the
// refreshed-token behavior.
vi.mock('../api/tokenProvider', () => ({
  getToken: vi.fn(),
}));

import { getToken } from '../api/tokenProvider';
import createInvestigationStream from '../api/streamApi';

describe('streamApi', () => {
  it('parses events and stops on awaiting_approval (smoke)', async () => {
    // Mock fetch and stream body
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('event: retrieving_telemetry\ndata: {"step":1}\n\n'),
      encoder.encode('event: awaiting_approval\ndata: {"step":6}\n\n'),
    ];

    const rs = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      }
    });

    // Ensure tokenProvider returns a token initially and a refreshed token
    // when called with `true` during 401 handling.
    (getToken as unknown as { mockReset?: () => void }).mockReset?.();
    (getToken as unknown as { mockResolvedValueOnce?: (v: any) => void }).mockResolvedValueOnce?.('OLD-TOKEN');
    (getToken as unknown as { mockResolvedValueOnce?: (v: any) => void }).mockResolvedValueOnce?.('NEW-TOKEN');

    // First call simulates 401 Unauthorized, second call returns the stream
    let call = 0;
    global.fetch = vi.fn((url: string, opts: any) => {
      call++;
      if (call === 1) return Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized' } as any);
      return Promise.resolve({ ok: true, body: rs } as any);
    });

    const events: any[] = [];
    const svc = createInvestigationStream('INC-2026-0827', (ev) => events.push(ev), (err) => {
      // avoid noisy logging in CI; surface as test failure by throwing
      throw err instanceof Error ? err : new Error(String(err));
    });
    await svc.start();
    // allow microtasks / macrotask scheduling for stream processing
    await new Promise(r => setTimeout(r, 0));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
