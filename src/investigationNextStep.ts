import type { InvestigationCase } from './types';

export interface InvestigationNextStep {
  stage: string;
  anchor: string;
  description: string;
  buttonLabel: string;
}

export function investigationNextStep(currentCase: InvestigationCase): InvestigationNextStep {
  const decision = currentCase.approval?.decision;

  if (currentCase.outcome) {
    return { stage: 'outcome', anchor: 'outcome', description: 'The investigation has an outcome. Review the confirmed cause and result.', buttonLabel: 'View outcome' };
  }
  if (decision === 'APPROVED') {
    return { stage: 'outcome', anchor: 'outcome', description: 'An action was approved. Review its execution and outcome.', buttonLabel: 'View action' };
  }
  if (decision === 'REJECTED') {
    return { stage: 'audit', anchor: 'audit', description: 'The proposed action was rejected. Review the decision record before revisiting the options.', buttonLabel: 'Review decision record' };
  }
  if (decision === 'REQUEST_MORE_EVIDENCE' || decision === 'MORE_EVIDENCE_REQUESTED') {
    return { stage: 'evidence', anchor: 'evidence', description: 'More evidence was requested. Review the available records and what still needs checking.', buttonLabel: 'Review evidence' };
  }
  if (!currentCase.evidence?.length) {
    return { stage: 'evidence', anchor: 'evidence', description: 'Evidence is still being gathered for this incident.', buttonLabel: 'View evidence' };
  }
  if (!currentCase.hypotheses?.length) {
    return { stage: 'why', anchor: 'hypotheses', description: 'The leading explanation is still being developed.', buttonLabel: 'View explanations' };
  }
  if (decision === 'CHALLENGE' || !currentCase.critic_finding) {
    return { stage: 'critic', anchor: 'critic', description: 'Challenge the leading explanation against conflicting evidence.', buttonLabel: 'Review the challenge' };
  }
  if (!currentCase.recommendation || !currentCase.simulation_results?.length) {
    return { stage: 'simulate', anchor: 'simulation', description: 'Compare possible responses before seeking a human decision.', buttonLabel: 'Compare options' };
  }
  return { stage: 'approve', anchor: 'approval', description: currentCase.recommendation.next_step || 'Review the recommended action and make a decision.', buttonLabel: 'Review recommendation' };
}
