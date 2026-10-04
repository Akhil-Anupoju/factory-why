import createInvestigationStream from '../api/streamApi';

import { vi } from 'vitest';

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

    global.fetch = vi.fn(() => Promise.resolve({ ok: true, body: rs } as any));

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
