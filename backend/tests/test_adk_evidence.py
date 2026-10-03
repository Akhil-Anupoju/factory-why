from backend.app.adk.state import InvestigationState, EvidenceRef, AuditEvent
from pydantic import ValidationError
import pytest
import json


def test_add_evidence_accepts_evidence_ref_instance():
    state = InvestigationState(incident_id="INC-EDGE-01")
    ev = EvidenceRef(
        evidence_id="EV-OBJ",
        source="unit",
        timestamp="2026-10-03T00:00:00Z",
        asset="CNC-04",
        component="X",
        observation="obj-obs",
    )
    state.add_evidence(ev)
    assert len(state.evidence) == 1
    assert state.evidence[0].evidence_id == "EV-OBJ"


def test_add_evidence_accepts_valid_dict():
    state = InvestigationState(incident_id="INC-EDGE-02")
    ev_dict = {
        "evidence_id": "EV-DICT",
        "source": "unit",
        "timestamp": "2026-10-03T00:00:00Z",
        "asset": "CNC-04",
        "component": "X",
        "observation": "dict-obs",
    }
    state.add_evidence(ev_dict)
    assert len(state.evidence) == 1
    assert state.evidence[0].evidence_id == "EV-DICT"


def test_add_evidence_rejects_invalid_dict():
    state = InvestigationState(incident_id="INC-EDGE-03")
    # missing required `observation` field
    bad = {
        "evidence_id": "EV-BAD",
        "source": "unit",
        "timestamp": "2026-10-03T00:00:00Z",
        "asset": "CNC-04",
        "component": "X",
    }
    with pytest.raises(ValidationError):
        state.add_evidence(bad)


def test_model_dump_is_json_serializable_after_adding_evidence():
    state = InvestigationState(incident_id="INC-EDGE-04")
    state.add_evidence({
        "evidence_id": "EV-DICT-2",
        "source": "unit",
        "timestamp": "2026-10-03T00:00:00Z",
        "asset": "CNC-04",
        "component": "X",
        "observation": "dict-obs-2",
    })
    d = state.model_dump()
    # should be a JSON-serializable structure (no pydantic serializer objects left)
    json.dumps(d)
    assert "evidence" in d and isinstance(d["evidence"], list)
    assert isinstance(d["evidence"][0], dict)


def test_record_audit_accepts_and_rejects():
    state = InvestigationState(incident_id="INC-AUD-01")
    good = {
        "event_id": "EVT-1",
        "step_number": 1,
        "timestamp": "2026-10-03T00:00:00Z",
        "agent_role": "tester",
        "tool_call": "none",
        "summary": "ok",
    }
    state.record_audit(good)
    assert len(state.audit_events) == 1

    bad = {
        # missing required `step_number`
        "event_id": "EVT-BAD",
        "timestamp": "2026-10-03T00:00:00Z",
        "agent_role": "tester",
        "tool_call": "none",
        "summary": "ok",
    }
    with pytest.raises(ValidationError):
        state.record_audit(bad)
