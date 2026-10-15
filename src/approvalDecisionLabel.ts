import type { ApprovalDecision } from './types';

const labels: Record<ApprovalDecision, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REQUEST_MORE_EVIDENCE: 'More evidence requested',
  MORE_EVIDENCE_REQUESTED: 'More evidence requested',
  CHALLENGE: 'Theory challenged',
};

export const approvalDecisionLabel = (decision?: ApprovalDecision | null): string =>
  decision ? labels[decision] : 'Pending';
