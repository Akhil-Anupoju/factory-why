import { getToken } from './tokenProvider';

export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getApiBase(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any).env?.VITE_API_BASE_URL;
  return (v || '').replace(/\/$/, '');
}

export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (e) {
    // swallow token errors; callers will observe 401 from the server if necessary
  }
  return headers;
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  const finalUrl = url.startsWith('http') || url.startsWith('/') ? `${base}${url}`.replace('//api', '/api') : `${base}/${url}`.replace('//api', '/api');

  const headersFromToken = await buildAuthHeaders();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}), ...headersFromToken };

  let res: Response;
  try {
    res = await fetch(finalUrl, { ...init, headers, credentials: init.credentials || 'same-origin' });
  } catch (e: any) {
    throw new ApiError(`Network error: ${e?.message || e}`, null);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new ApiError('Authentication required', 401);
    }
    if (res.status === 403) {
      throw new ApiError('Forbidden', 403);
    }
    const text = await res.text().catch(() => '');
    throw new ApiError(`API error: ${res.status} ${res.statusText} - ${text}`, res.status);
  }

  return res;
}

export default { ApiError, buildAuthHeaders, authFetch };
