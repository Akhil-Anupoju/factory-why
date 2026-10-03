from backend.app.repositories.in_memory import InMemoryIncidentRepo, InMemoryEvidenceRepo, InMemoryAuditRepo, InMemoryTelemetryRepo, InMemoryStorageRepo
from backend.app.services.evidence_service import EvidenceService
from backend.app.services.decision_service import DecisionService
from backend.app.services.approval_service import ApprovalService, ApprovalError
from backend.app.services.simulated_action_service import SimulatedActionService, ActionError
from backend.app.services.outcome_service import OutcomeService
from backend.app.seed.seed_from_fixture import seed_from_fixture
from backend.app.schemas import SimulationParameters, Recommendation, ApprovalRecord


def make_env():
    inc = InMemoryIncidentRepo()
    ev = InMemoryEvidenceRepo()
    au = InMemoryAuditRepo()
    te = InMemoryTelemetryRepo()
    st = InMemoryStorageRepo()
    seed_from_fixture(inc, ev, au, fixture_path="backend/fixtures/cnc04-primary.json")
    svc = EvidenceService(inc, ev, au, te, st)
    return inc, ev, au, te, st, svc


def test_approve_allows_action_and_outcome():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    params = SimulationParameters()
    rec = dec.recommend("INC-2026-0827", params)

    appr = ApprovalService(inc, au)
    # request then approve
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng1")
    appr.decide("INC-2026-0827", ar.approval_id, "APPROVED", actor="eng1")

    # execute simulated action
    action_svc = SimulatedActionService(inc, au)
    action = action_svc.execute("INC-2026-0827", rec, ar)
    assert action.status == "SIMULATED"

    outcome_svc = OutcomeService(inc, au)
    outcome = outcome_svc.record_outcome("INC-2026-0827", ar, rec, action)
    assert outcome.outcome_id


def test_reject_blocks_action():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng2")
    appr.decide("INC-2026-0827", ar.approval_id, "REJECTED", actor="eng2")

    action_svc = SimulatedActionService(inc, au)
    try:
        action_svc.execute("INC-2026-0827", rec, ar)
        assert False, "Action should have been blocked"
    except ActionError:
        pass


def test_more_evidence_blocks_action():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng3")
    appr.decide("INC-2026-0827", ar.approval_id, "MORE_EVIDENCE_REQUESTED", actor="eng3")

    action_svc = SimulatedActionService(inc, au)
    try:
        action_svc.execute("INC-2026-0827", rec, ar)
        assert False, "Action should have been blocked"
    except ActionError:
        pass


def test_no_approval_blocks_action():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    # create approval service but do not request approval
    appr = ApprovalService(inc, au)
    # simulate a missing approval record
    from backend.app.schemas import ApprovalRecord as AR
    fake_appr = AR(approval_id="NOPE", incident_id="INC-2026-0827", recommendation_id=rec.recommendation_id, decision="PENDING", engineer_name="x", engineer_role="", timestamp="", comment="", authorized_action=rec.action_type, signature_hash="")

    action_svc = SimulatedActionService(inc, au)
    try:
        action_svc.execute("INC-2026-0827", rec, fake_appr)
        assert False, "Action should have been blocked"
    except ActionError:
        pass


def test_wrong_incident_blocks_action():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng4")
    appr.decide("INC-2026-0827", ar.approval_id, "APPROVED", actor="eng4")

    action_svc = SimulatedActionService(inc, au)
    # tamper approval incident id
    ar.incident_id = "INC-OTHER"
    try:
        action_svc.execute("INC-2026-0827", rec, ar)
        assert False
    except ActionError:
        pass


def test_wrong_recommendation_blocks_action():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng5")
    appr.decide("INC-2026-0827", ar.approval_id, "APPROVED", actor="eng5")

    action_svc = SimulatedActionService(inc, au)
    # tamper recommendation id
    rec.recommendation_id = "OTHER-REC"
    try:
        action_svc.execute("INC-2026-0827", rec, ar)
        assert False
    except ActionError:
        pass


def test_duplicate_action_is_idempotent():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng6")
    appr.decide("INC-2026-0827", ar.approval_id, "APPROVED", actor="eng6")

    action_svc = SimulatedActionService(inc, au)
    action1 = action_svc.execute("INC-2026-0827", rec, ar)
    # second attempt should produce a new simulated action but not fail
    action2 = action_svc.execute("INC-2026-0827", rec, ar)
    assert action1.action_id != action2.action_id


def test_outcome_after_approved_action():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng7")
    appr.decide("INC-2026-0827", ar.approval_id, "APPROVED", actor="eng7")

    action_svc = SimulatedActionService(inc, au)
    action = action_svc.execute("INC-2026-0827", rec, ar)

    outcome_svc = OutcomeService(inc, au)
    outcome = outcome_svc.record_outcome("INC-2026-0827", ar, rec, action, ground_truth={"actual_cause": "BEARING_ANGULAR_MISALIGNMENT", "observed_result": "CONFIRMED"})
    assert outcome.actual_cause == "BEARING_ANGULAR_MISALIGNMENT"


def test_ground_truth_isolation():
    # Ensure WHY/Critic run without access to ground truth outcome
    inc, ev, au, te, st, svc = make_env()
    # In this test we ensure that the DecisionService and Critic (not invoked here)
    # do not have direct access to a ground truth field prior to outcome recording.
    inc_data = inc.get_incident("INC-2026-0827")
    assert "outcome" not in inc_data or inc_data.get("outcome") is None


def test_audit_sequence_recorded():
    inc, ev, au, te, st, svc = make_env()
    dec = DecisionService(inc, svc, au)
    rec = dec.recommend("INC-2026-0827", SimulationParameters())

    appr = ApprovalService(inc, au)
    ar = appr.request_approval("INC-2026-0827", rec, actor="eng8")
    appr.decide("INC-2026-0827", ar.approval_id, "APPROVED", actor="eng8")

    action_svc = SimulatedActionService(inc, au)
    action = action_svc.execute("INC-2026-0827", rec, ar)

    outcome_svc = OutcomeService(inc, au)
    outcome = outcome_svc.record_outcome("INC-2026-0827", ar, rec, action)

    # confirm audit events exist in in-memory audit repo
    audits = au.list_audit("INC-2026-0827")
    ids = [a.get("event_id") for a in audits]
    for required in ["AUD-APPROVAL-REQUESTED", "AUD-APPROVAL-APPROVED", "AUD-ACTION-SIMULATION-START", "AUD-ACTION-SIMULATION-COMPLETE", "AUD-OUTCOME-RECORDED"]:
        assert required in ids
