import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, authFetch } from '../api/apiClient';
import { postChallenge, postRequestEvidence } from '../api/incidentApi';

vi.mock('../api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/apiClient')>();
  return { ...actual, authFetch: vi.fn() };
});

const mockedAuthFetch = vi.mocked(authFetch);

function jsonResponse(payload: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 502 ? 'Bad Gateway' : 'OK',
    json: async () => payload,
  } as Response;
}

describe('incidentApi live agent calls', () => {
  afterEach(() => {
    mockedAuthFetch.mockReset();
  });

  it('surfaces a failed Critic response instead of treating the error body as findings', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({ detail: 'Vertex AI unavailable' }, 502));

    const error = await postChallenge('INC-TEST').catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502 });
    expect((error as Error).message).toContain('Vertex AI unavailable');
  });

  it('surfaces a failed targeted retrieval response instead of accepting an error payload', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({ detail: 'No live model configured' }, 502));

    const error = await postRequestEvidence('INC-TEST').catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502 });
    expect((error as Error).message).toContain('No live model configured');
  });
});
