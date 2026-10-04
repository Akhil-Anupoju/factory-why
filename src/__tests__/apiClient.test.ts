import { buildAuthHeaders, authFetch, ApiError } from '../api/apiClient';

// Mock tokenProvider.getToken using Vitest-compatible API
import { vi } from 'vitest';
vi.mock('../api/tokenProvider', () => ({
  getToken: vi.fn(),
}));

import { getToken } from '../api/tokenProvider';

describe('apiClient', () => {
  beforeEach(() => {
    (getToken as unknown as { mockReset: () => void }).mockReset?.();
  });

  it('buildAuthHeaders attaches token when present', async () => {
    (getToken as unknown as { mockResolvedValue: (v: any) => void }).mockResolvedValue?.('tok');
    const h = await buildAuthHeaders();
    expect(h.Authorization).toBe('Bearer tok');
  });

  it('authFetch throws ApiError on 401', async () => {
    (getToken as unknown as { mockResolvedValue: (v: any) => void }).mockResolvedValue?.(null);
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => '' } as any));
    await expect(authFetch('/api/health')).rejects.toThrow('Authentication required');
  });
});
