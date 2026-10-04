import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// App and dependencies
import App from '../App';
import * as incidentApi from '../api/incidentApi';
import * as tokenProvider from '../api/tokenProvider';
import { PRIMARY_SCENARIO_CNC04, GROUND_TRUTH_OUTCOME_CNC04 } from '../data/mockScenarios';
import { ApiError } from '../api/apiClient';

// expose a signOut spy that tests can assert against
const signOutSpy = vi.fn();

// Mock AuthProvider to avoid real Firebase: render App but stub Auth context
vi.mock('../auth/AuthContext', () => {
  return {
    useAuth: () => ({ user: { uid: 'U-1', displayName: 'Test User' }, loading: false, isAuthenticated: true, signIn: async () => {}, signOut: signOutSpy }),
    AuthProvider: ({ children }: any) => children,
  };
});

// Mock the SSE stream so tests don't attempt a real fetch/AbortSignal crossing
vi.mock('../api/streamApi', () => ({
  __esModule: true,
  default: (incidentId: string, onEvent: any, onError: any) => ({
    start: async () => {},
    stop: () => {},
    isRunning: () => false,
  }),
}));

describe('Approval & Action live wiring', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    signOutSpy.mockReset();
    // default: stub token provider to return a token
    vi.spyOn(tokenProvider, 'getToken' as any).mockResolvedValue('FAKE-TOKEN');
    // default: incident load succeeds with the primary scenario
    vi.spyOn(incidentApi, 'fetchIncident' as any).mockResolvedValue(PRIMARY_SCENARIO_CNC04 as any);
  });

  it('does not call live endpoints in demo mode', async () => {
    // when fetchIncident fails and fallbackToMock is used, postApproval should not be called
    (incidentApi.fetchIncident as any).mockRejectedValueOnce(new Error('network'));
    const postSpy = vi.spyOn(incidentApi as any, 'postApproval');
    const { container } = render(<App />);
    // Wait a moment for UI to settle
    await waitFor(() => expect(container).toBeTruthy());
    // Ensure postApproval was not called in demo mode
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('approval success -> enables execute and respects server-confirmed approval', async () => {
    const serverApproval = { ...PRIMARY_SCENARIO_CNC04.approval, approval_id: 'APP-SRV-1', recommendation_id: PRIMARY_SCENARIO_CNC04.recommendation.recommendation_id, decision: 'APPROVED', engineer_name: 'Srv Eng' } as any;
    const postApprovalSpy = vi.spyOn(incidentApi as any, 'postApproval').mockResolvedValue(serverApproval);
    const postActionSpy = vi.spyOn(incidentApi as any, 'postAction').mockResolvedValue({ action: { action_id: 'ACT-1', incident_id: PRIMARY_SCENARIO_CNC04.incident_id, approval_id: serverApproval.approval_id, task_type: 'X', task_number: 'TASK-1', assigned_technician: 'T', required_tools: [], status: 'DISPATCHED', dispatched_at: new Date().toISOString(), target_component: 'X', procedure_checklist: [] }, outcome: GROUND_TRUTH_OUTCOME_CNC04 } as any);

    render(<App />);

    // Wait until ApprovalPanel renders with PENDING
    await screen.findByText(/Human-in-the-Loop Safety Gate & Authorization/);

    const approveBtn = screen.getByText('Approve Action');
    fireEvent.click(approveBtn);

    await waitFor(() => expect(postApprovalSpy).toHaveBeenCalled());
    // Ensure we didn't send an actor field
    const calledBody = (postApprovalSpy.mock.calls[0][1] || {}) as Record<string, any>;
    expect(calledBody.actor).toBeUndefined();

    // After server-confirmed approval, approved UI should render
    await screen.findByText(/Action Formally Authorized by/);

    // Execute button should be available now
    const execBtn = await screen.findByText(/Complete Physical Inspection & Reveal Ground Truth/);
    expect(execBtn).toBeTruthy();

    // Click execute and ensure postAction called and outcome displayed
    fireEvent.click(execBtn);
    await waitFor(() => expect(postActionSpy).toHaveBeenCalled());
    if (GROUND_TRUTH_OUTCOME_CNC04) await screen.findByText(GROUND_TRUTH_OUTCOME_CNC04.actual_cause);
  });

  it('approval 401 -> signs out and shows error', async () => {
    const postApprovalSpy = vi.spyOn(incidentApi as any, 'postApproval').mockRejectedValue(new ApiError('Authentication required', 401));
    render(<App />);
    await screen.findByText(/Human-in-the-Loop Safety Gate & Authorization/);
    const approveBtn = screen.getByText('Approve Action');
    fireEvent.click(approveBtn);
    await waitFor(() => expect(postApprovalSpy).toHaveBeenCalled());
    // signOut should have been called
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('approval 403 -> not authorized (no signout)', async () => {
    const postApprovalSpy = vi.spyOn(incidentApi as any, 'postApproval').mockRejectedValue(new ApiError('Forbidden', 403));
    render(<App />);
    await screen.findByText(/Human-in-the-Loop Safety Gate & Authorization/);
    const approveBtn = screen.getByText('Approve Action');
    fireEvent.click(approveBtn);
    await waitFor(() => expect(postApprovalSpy).toHaveBeenCalled());
    expect(signOutSpy).not.toHaveBeenCalled();
  });

  it('action 401 -> signs out', async () => {
    const serverApproval = { ...PRIMARY_SCENARIO_CNC04.approval, approval_id: 'APP-SRV-2', recommendation_id: PRIMARY_SCENARIO_CNC04.recommendation.recommendation_id, decision: 'APPROVED' } as any;
    vi.spyOn(incidentApi as any, 'postApproval').mockResolvedValue(serverApproval);
    const postActionSpy = vi.spyOn(incidentApi as any, 'postAction').mockRejectedValue(new ApiError('Authentication required', 401));

    render(<App />);
    await screen.findByText(/Human-in-the-Loop Safety Gate & Authorization/);
    fireEvent.click(screen.getByText('Approve Action'));
    await waitFor(() => expect(postActionSpy).not.toHaveBeenCalled());

    // Wait for approval to be applied
    await screen.findByText(/Action Formally Authorized by/);
    // Click execute
    fireEvent.click(await screen.findByText(/Complete Physical Inspection & Reveal Ground Truth/));
    await waitFor(() => expect(postActionSpy).toHaveBeenCalled());
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('duplicate approval prevented', async () => {
    let resolveApproval: ((v?: any) => void) | undefined = undefined;
    const approvalPromise = new Promise((res) => { resolveApproval = res; });
    const postApprovalSpy = vi.spyOn(incidentApi as any, 'postApproval').mockImplementation(() => approvalPromise as any);

    render(<App />);
    await screen.findByText(/Human-in-the-Loop Safety Gate & Authorization/);
    const approveBtn = screen.getByText('Approve Action');
    // click twice quickly
    fireEvent.click(approveBtn);
    fireEvent.click(approveBtn);
    // resolve underlying promise
    resolveApproval!({ ...PRIMARY_SCENARIO_CNC04.approval, approval_id: 'APP-SRV-3', recommendation_id: PRIMARY_SCENARIO_CNC04.recommendation.recommendation_id, decision: 'APPROVED' });
    await waitFor(() => expect(postApprovalSpy).toHaveBeenCalledTimes(1));
  });

  it('duplicate action prevented', async () => {
    const serverApproval = { ...PRIMARY_SCENARIO_CNC04.approval, approval_id: 'APP-SRV-4', recommendation_id: PRIMARY_SCENARIO_CNC04.recommendation.recommendation_id, decision: 'APPROVED' } as any;
    vi.spyOn(incidentApi as any, 'postApproval').mockResolvedValue(serverApproval);
    let resolveAction: ((v?: any) => void) | undefined = undefined;
    const actionPromise = new Promise((res) => { resolveAction = res; });
    const postActionSpy = vi.spyOn(incidentApi as any, 'postAction').mockImplementation(() => actionPromise as any);

    render(<App />);
    await screen.findByText(/Human-in-the-Loop Safety Gate & Authorization/);
    fireEvent.click(screen.getByText('Approve Action'));
    await screen.findByText(/Action Formally Authorized by/);
    const execBtn = await screen.findByText(/Complete Physical Inspection & Reveal Ground Truth/);
    fireEvent.click(execBtn);
    fireEvent.click(execBtn);
    resolveAction!({ action: { action_id: 'ACT-2', incident_id: PRIMARY_SCENARIO_CNC04.incident_id, approval_id: serverApproval.approval_id, task_type: 'T', task_number: 'TASK-2', assigned_technician: 'T', required_tools: [], status: 'DISPATCHED', dispatched_at: new Date().toISOString(), target_component: 'X', procedure_checklist: [] }, outcome: GROUND_TRUTH_OUTCOME_CNC04 });
    await waitFor(() => expect(postActionSpy).toHaveBeenCalledTimes(1));
  });
});
