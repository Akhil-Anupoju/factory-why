"""Unit tests for the live investigation service's response mapping layer
(adk.state -> backend.schemas contract). These guard against the exact
regression found during live Vertex AI validation: CriticFinding.ignored_evidence
requires 'observation', which the raw ADK CriticFinding does not carry.
"""
from backend.app.adk.state import CriticFinding as AdkCriticFinding, EvidenceRef, Hypothesis as AdkHypothesis
from backend.app.services.investigation_service import _map_critic_finding, _map_hypothesis
from backend.app import schemas


def test_map_critic_finding_resolves_ignored_evidence_observation():
    cf = AdkCriticFinding(
        critic_id="CRITIC-TEST-1",
        target_hypothesis_id="H1",
        contradictions=[{"point": "p", "conflicting_evidence_ids": ["EV-1"], "rationale": "r"}],
        ignored_evidence=[{"evidence_id": "EV-2"}],
        falsification_condition="runout < 0.02mm",
        most_discriminating_missing_evidence="dial indicator reading",
        confidence_revision=-0.1,
        request_more_evidence=None,
    )
    evidence_by_id = {
        "EV-2": EvidenceRef(
            evidence_id="EV-2", source="Maintenance", timestamp="t", asset="CNC-04",
            component="bearing", observation="Technician noted tight collar fit.",
        )
    }

    mapped = _map_critic_finding(cf, "2026-01-01T00:00:00Z", evidence_by_id)

    # Must validate against the real API contract (this is what caught the bug)
    validated = schemas.CriticFinding.model_validate(mapped)
    assert validated.ignored_evidence[0].evidence_id == "EV-2"
    assert validated.ignored_evidence[0].observation == "Technician noted tight collar fit."
    assert validated.contradictions[0].conflicting_evidence_id == "EV-1"
    assert validated.recommendation_action == "REVISE_CONFIDENCE"


def test_map_critic_finding_ignored_evidence_without_lookup_uses_safe_default():
    cf = AdkCriticFinding(
        critic_id="CRITIC-TEST-2",
        target_hypothesis_id="H1",
        contradictions=[],
        ignored_evidence=[{"evidence_id": "EV-9"}],
        falsification_condition="x",
        request_more_evidence={"tool": "get_inspection_image", "params": {}},
    )
    mapped = _map_critic_finding(cf, "2026-01-01T00:00:00Z", evidence_by_id=None)
    validated = schemas.CriticFinding.model_validate(mapped)
    assert validated.ignored_evidence[0].observation  # non-empty safe fallback, never missing
    assert validated.recommendation_action == "REQUEST_MORE_EVIDENCE"


def test_map_hypothesis_handles_schema_shaped_object():
    h = schemas.Hypothesis(
        hypothesis_id="H1", title="T", description="D", status="LIKELY", confidence=0.7,
        inferred_mechanism="m", supporting_evidence_ids=["EV-1"], counter_evidence_ids=[],
        missing_evidence=[], next_discriminating_check=None, likelihood_rank=0,
    )
    mapped = _map_hypothesis(h, rank=1)
    validated = schemas.Hypothesis.model_validate(mapped)
    assert validated.likelihood_rank == 1
    assert validated.hypothesis_id == "H1"


def test_map_hypothesis_handles_narrow_adk_hypothesis():
    h = AdkHypothesis(hypothesis_id="H2", title=None, description="desc", status="competing", confidence=0.4)
    mapped = _map_hypothesis(h, rank=2)
    validated = schemas.Hypothesis.model_validate(mapped)
    assert validated.status == "COMPETING"
    assert validated.likelihood_rank == 2
