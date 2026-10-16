import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditPanel } from '../components/AuditPanel';
import { AuditEvent } from '../types';

const event: AuditEvent = {
  event_id: 'AUD-TEST-1',
  step_number: 1,
  timestamp: '2026-10-16T12:00:00Z',
  agent_role: 'Root Orchestrator',
  tool_call: 'get_asset_context',
  summary: 'Loaded asset context',
  request_payload: { asset_id: 'CNC-04' },
  response_payload: { status: 'ABNORMAL' },
  status: 'SUCCESS',
};

describe('AuditPanel', () => {
  it('keeps an audit event keyboard-operable and exposes its expanded state', () => {
    render(<AuditPanel auditTrail={[event]} />);

    const eventButton = screen.getByRole('button', { name: /get_asset_context/ });
    expect(eventButton).toHaveAttribute('aria-expanded', 'false');
    expect(eventButton).toHaveClass('fw-audit-event-row');

    fireEvent.click(eventButton);
    expect(eventButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(/Loaded asset context/)).toHaveLength(2);
  });
});
