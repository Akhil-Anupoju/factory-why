import { InvestigationCase, ApprovalRecord, ActionRecord, OutcomeRecord, AuditEvent } from '../types';
import { authFetch, ApiError as ClientApiError } from './apiClient';

class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getApiBase(): string {
  // Vite exposes env vars prefixed with VITE_. Use same-origin as default.
  // Consumers must set VITE_API_BASE_URL in their environment when needed.
  // Do not embed credentials here.
  // Leaving empty string will cause fetch to use same origin.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any).env?.VITE_API_BASE_URL;
  return v || '';
}

export async function fetchIncident(incidentId: string): Promise<InvestigationCase> {
  const base = getApiBase().replace(/\/$/, '');
  const path = `${base}/api/incidents/${encodeURIComponent(incidentId)}`.replace('//api', '/api');

  let res: Response;
  try {
    res = await authFetch(path, { method: 'GET' });
  } catch (err: any) {
    // network error
    if (err instanceof ClientApiError) throw err;
    throw new ClientApiError(`Network error while fetching incident: ${err?.message || err}`, null);
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new ApiError(`Incident not found: ${incidentId}`, 404);
    }
    const text = await res.text();
    throw new ApiError(`API error: ${res.status} ${res.statusText} - ${text}`, res.status);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err: any) {
    throw new ApiError(`Failed to parse JSON response: ${err?.message || err}`, res.status);
  }

  // Basic runtime validation: ensure payload has incident_id
  const obj = payload as Record<string, any>;
  if (!obj || typeof obj.incident_id !== 'string') {
    throw new ApiError('Malformed incident payload: missing incident_id', res.status);
  }

  // Validate required fields match the frontend contract. In Live/CLOUD
  // runtimes we must fail-fast on malformed responses so the UI can
  // surface a clear API contract error instead of crashing during render.
  const requiredArrayFields = ['evidence', 'telemetry_series', 'audit_trail'];
  for (const field of requiredArrayFields) {
    if (!Array.isArray(obj[field])) {
      throw new ApiError(`Malformed incident payload: expected array '${field}'`, res.status);
    }
  }

  if (!obj.asset || typeof obj.asset !== 'object' || !Array.isArray(obj.asset.components)) {
    throw new ApiError('Malformed incident payload: invalid or missing asset.components', res.status);
  }

  if (!obj.recommendation || typeof obj.recommendation !== 'object') {
    throw new ApiError('Malformed incident payload: missing recommendation', res.status);
  }

  if (!obj.approval || typeof obj.approval !== 'object') {
    throw new ApiError('Malformed incident payload: missing approval', res.status);
  }

  return obj as InvestigationCase;
}

export async function postApproval(incidentId: string, body: { recommendation: any; decision: string; comment?: string }): Promise<ApprovalRecord> {
  const base = getApiBase().replace(/\/$/, '');
  const path = `${base}/api/incidents/${encodeURIComponent(incidentId)}/approve`.replace('//api', '/api');

  let res: Response;
  try {
    res = await authFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err: any) {
    if (err instanceof ClientApiError) throw err;
    throw new ClientApiError(`Network error while posting approval: ${err?.message || err}`, null);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err: any) {
    throw new ApiError(`Failed to parse JSON response: ${err?.message || err}`, res.status);
  }

  const obj = payload as any;
  if (!obj || typeof obj.approval_id !== 'string') {
    throw new ApiError('Malformed approval payload: missing approval_id', res.status);
  }

  return obj as ApprovalRecord;
}

export async function postAction(incidentId: string, body: { recommendation: any; approval_id: string }): Promise<{ action: ActionRecord; outcome: OutcomeRecord }> {
  const base = getApiBase().replace(/\/$/, '');
  const path = `${base}/api/incidents/${encodeURIComponent(incidentId)}/actions`.replace('//api', '/api');

  let res: Response;
  try {
    res = await authFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err: any) {
    if (err instanceof ClientApiError) throw err;
    throw new ClientApiError(`Network error while posting action: ${err?.message || err}`, null);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err: any) {
    throw new ApiError(`Failed to parse JSON response: ${err?.message || err}`, res.status);
  }

  const obj = payload as any;
  if (!obj || !obj.action || !obj.outcome) {
    throw new ApiError('Malformed action response: missing action or outcome', res.status);
  }

  return { action: obj.action as ActionRecord, outcome: obj.outcome as OutcomeRecord };
}

export async function fetchOutcome(incidentId: string): Promise<OutcomeRecord | null> {
  const base = getApiBase().replace(/\/$/, '');
  const path = `${base}/api/incidents/${encodeURIComponent(incidentId)}/outcome`.replace('//api', '/api');

  let res: Response;
  try {
    res = await authFetch(path, { method: 'GET' });
  } catch (err: any) {
    if (err instanceof ClientApiError) throw err;
    throw new ClientApiError(`Network error while fetching outcome: ${err?.message || err}`, null);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err: any) {
    throw new ApiError(`Failed to parse JSON response: ${err?.message || err}`, res.status);
  }

  const obj = payload as any;
  return obj ? (obj.outcome as OutcomeRecord) : null;
}

export async function fetchAudit(incidentId: string): Promise<AuditEvent[]> {
  const base = getApiBase().replace(/\/$/, '');
  const path = `${base}/api/incidents/${encodeURIComponent(incidentId)}/audit`.replace('//api', '/api');

  let res: Response;
  try {
    res = await authFetch(path, { method: 'GET' });
  } catch (err: any) {
    if (err instanceof ClientApiError) throw err;
    throw new ClientApiError(`Network error while fetching audit: ${err?.message || err}`, null);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err: any) {
    throw new ApiError(`Failed to parse JSON response: ${err?.message || err}`, res.status);
  }

  const obj = payload as any;
  return Array.isArray(obj?.audit) ? (obj.audit as AuditEvent[]) : [];
}

export { ApiError };

export async function postChallenge(incidentId: string, body: Record<string, any> = {}): Promise<any> {
  const base = getApiBase().replace(/\/$/, '');
  const path = `${base}/api/incidents/${encodeURIComponent(incidentId)}/challenge`.replace('//api', '/api');

  let res: Response;
  try {
    res = await authFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err: any) {
    if (err instanceof ClientApiError) throw err;
    throw new ClientApiError(`Network error while posting challenge: ${err?.message || err}`, null);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch (err: any) {
    throw new ApiError(`Failed to parse JSON response: ${err?.message || err}`, res.status);
  }

  return payload;
}
