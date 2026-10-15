/**
 * Decision Readiness Check
 *
 * A deterministic, client-side gate that is evaluated before a human signs
 * off on a recommendation. This is intentionally NOT an LLM call: it is a
 * fixed set of arithmetic/lookup checks over data already present on the
 * investigation case (confidence, critic coverage, evidence grounding,
 * open evidence gaps, modeled uncertainty).
 *
 * This keeps a hard boundary between:
 *  - AI reasoning (the Critic agent's live challenge of the leading
 *    explanation, triggered from the Critic section), and
 *  - Deterministic calculation (this readiness score), which never calls
 *    the network and always produces the same result for the same data.
 *
 * It intentionally does not duplicate the Critic's job: it does not
 * generate new contradictions or evidence. It only checks whether the
 * work the Critic / WHY / Recommendation agents already produced meets a
 * fixed bar before a human is asked to authorize dispatch.
 */
import { InvestigationCase } from './types';

export type ReadinessStatus = 'PASS' | 'WARN' | 'FAIL';

export interface ReadinessCheckItem {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export interface DecisionReadiness {
  overall: 'READY' | 'REVIEW_RECOMMENDED' | 'NOT_READY';
  checks: ReadinessCheckItem[];
  leadingHypothesisTitle: string;
  confidencePct: number;
  evidenceGroundingPct: number;
  uncertaintyPct: number;
  criticReviewed: boolean;
  /**
   * The single highest-value next action for the engineer to take, derived
   * from which check(s) are failing/warning. Always non-null so the UI can
   * always tell the engineer exactly what to do next instead of presenting
   * four buttons with no guidance.
   */
  recommendedAction: { action: 'RUN_CRITIQUE' | 'REQUEST_EVIDENCE' | 'APPROVE'; label: string; reason: string };
}

export function computeDecisionReadiness(investigationCase: InvestigationCase): DecisionReadiness {
  const hypotheses = investigationCase.hypotheses || [];
  const leading = [...hypotheses].sort((a, b) => a.likelihood_rank - b.likelihood_rank)[0];
  const recommendation = investigationCase.recommendation;
  const criticFinding = investigationCase.critic_finding;
  const evidence = investigationCase.evidence || [];

  const checks: ReadinessCheckItem[] = [];

  // 1. Leading explanation confidence
  const confidencePct = leading ? Math.round(leading.confidence * 100) : 0;
  checks.push({
    key: 'confidence',
    label: 'Leading explanation confidence',
    status: !leading ? 'FAIL' : confidencePct >= 70 ? 'PASS' : confidencePct >= 50 ? 'WARN' : 'FAIL',
    detail: leading
      ? `${leading.title} is at ${confidencePct}% confidence.`
      : 'No leading explanation has been identified yet.',
  });

  // 2. Critic challenge coverage
  const criticReviewed = !!criticFinding && (!leading || criticFinding.target_hypothesis_id === leading.hypothesis_id);
  checks.push({
    key: 'critic',
    label: 'Critic challenge completed',
    status: !criticReviewed ? 'FAIL' : criticFinding!.contradictions.length > 0 ? 'WARN' : 'PASS',
    detail: criticReviewed
      ? `${criticFinding!.contradictions.length} contradiction(s) found against the leading explanation.`
      : 'The leading explanation has not been challenged by the Critic yet.',
  });

  // 3. Evidence grounding of the recommendation
  const refs = recommendation?.evidence_references || [];
  const matchedRefs = refs.filter((id) => evidence.some((e) => e.evidence_id === id));
  const evidenceGroundingPct = refs.length > 0 ? Math.round((matchedRefs.length / refs.length) * 100) : 0;
  checks.push({
    key: 'evidence',
    label: 'Recommendation evidence grounding',
    status: refs.length === 0 ? 'FAIL' : evidenceGroundingPct === 100 ? 'PASS' : evidenceGroundingPct >= 50 ? 'WARN' : 'FAIL',
    detail:
      refs.length > 0
        ? `${matchedRefs.length} of ${refs.length} cited evidence record(s) are present in this incident.`
        : 'The recommendation does not cite any evidence records.',
  });

  // 4. Open evidence gaps on the leading explanation
  const missingCount = leading?.missing_evidence?.length || 0;
  checks.push({
    key: 'missing_evidence',
    label: 'Open evidence gaps',
    status: missingCount === 0 ? 'PASS' : missingCount <= 1 ? 'WARN' : 'FAIL',
    detail:
      missingCount === 0
        ? 'No outstanding evidence gaps recorded for the leading explanation.'
        : `${missingCount} identified evidence gap(s) remain unresolved.`,
  });

  // 5. Modeled uncertainty on the recommendation
  const uncertaintyPct = recommendation?.uncertainty_pct ?? 100;
  checks.push({
    key: 'uncertainty',
    label: 'Recommendation uncertainty',
    status: uncertaintyPct <= 15 ? 'PASS' : uncertaintyPct <= 30 ? 'WARN' : 'FAIL',
    detail: `Recommendation carries ${uncertaintyPct}% modeled uncertainty.`,
  });

  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const overall: DecisionReadiness['overall'] = failCount > 0 ? 'NOT_READY' : warnCount > 0 ? 'REVIEW_RECOMMENDED' : 'READY';

  const missingEvidenceCheck = checks.find((c) => c.key === 'missing_evidence')!;
  const evidenceCheck = checks.find((c) => c.key === 'evidence')!;
  const criticCheck = checks.find((c) => c.key === 'critic')!;

  // Priority order for the single recommended action: challenge the
  // explanation before chasing more data (a weak explanation isn't worth
  // more evidence), then close evidence gaps, then it's safe to approve.
  let recommendedAction: DecisionReadiness['recommendedAction'];
  if (criticCheck.status === 'FAIL') {
    recommendedAction = {
      action: 'RUN_CRITIQUE',
      label: 'Challenge the hypothesis',
      reason: 'The leading explanation has not been challenged yet. Test it against conflicting evidence before gathering more evidence or approving.',
    };
  } else if (missingEvidenceCheck.status === 'FAIL' || evidenceCheck.status === 'FAIL') {
    recommendedAction = {
      action: 'REQUEST_EVIDENCE',
      label: 'Request Evidence',
      reason: missingEvidenceCheck.status === 'FAIL'
        ? missingEvidenceCheck.detail
        : evidenceCheck.detail,
    };
  } else if (missingEvidenceCheck.status === 'WARN' || evidenceCheck.status === 'WARN' || warnCount > 0) {
    recommendedAction = {
      action: 'REQUEST_EVIDENCE',
      label: 'Request Evidence',
      reason: 'Minor gaps remain. Closing them first will strengthen the case before you sign off.',
    };
  } else {
    recommendedAction = {
      action: 'APPROVE',
      label: 'Approve',
      reason: 'All readiness checks pass — the explanation has been challenged and is well grounded in evidence.',
    };
  }

  return {
    overall,
    checks,
    leadingHypothesisTitle: leading?.title || 'No leading explanation',
    confidencePct,
    evidenceGroundingPct,
    uncertaintyPct,
    criticReviewed,
    recommendedAction,
  };
}
