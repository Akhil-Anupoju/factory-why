from backend.app.adk.workflow import RootOrchestrator
from backend.app.adk.evidence_agent import EvidenceAgent
from backend.app.adk.why_agent import WhyAgent
from backend.app.adk.critic_agent import CriticAgent
from backend.app.adk.state import InvestigationState, AssetContext
from backend.app.tools.tool_impl import AllowlistedTools
from backend.app.repositories.in_memory import (
    InMemoryIncidentRepo,
    InMemoryEvidenceRepo,
    InMemoryAuditRepo,
    InMemoryTelemetryRepo,
    InMemoryStorageRepo,
)
from backend.app.seed.seed_from_fixture import seed_from_fixture
import pytest


def make_agent_with_fixture():
    inc = InMemoryIncidentRepo()
    ev = InMemoryEvidenceRepo()
    au = InMemoryAuditRepo()
    te = InMemoryTelemetryRepo()
    st = InMemoryStorageRepo()
    seed_from_fixture(inc, ev, au, fixture_path="backend/fixtures/cnc04-primary.json")
    # seed telemetry rows as in tests/test_tools
    data_inc = inc.get_incident("INC-2026-0827")
    asset_id = data_inc.get("asset", {}).get("asset_id")
    channel_map = [
        ("VIB-B04", "vibration"),
        ("TEMP-B04", "temperature"),
        ("CURR-M01", "motor_current"),
        ("RPM-S01", "rpm"),
        ("PRESS-HYD01", "pressure"),
    ]
    for row in data_inc.get("telemetry_series", []):
        for sensor_id, field in channel_map:
            te.seed_rows([
                {
                    "timestamp": row["timestamp"],
                    "display_time": row.get("display_time"),
                    "sensor_id": sensor_id,
                    "value": row.get(field),
                    "asset_id": asset_id,
                    "scenario_id": "telemetry_raw",
                    "is_anomalous": row.get("is_anomalous", False),
                }
            ])

    st.put_metadata("incidents/INC-2026-0827/inspection_ir_optical_b04.jpg", {"size": 345678, "contentType": "image/jpeg"})

    from backend.app.services.evidence_service import EvidenceService

    svc = EvidenceService(inc, ev, au, te, st)
    tools = AllowlistedTools(inc, ev, te, st, svc)
    agent = EvidenceAgent(tools=tools, model="local-fake")
    why = WhyAgent(model=None)
    critic = CriticAgent(model=None)
    return agent, why, critic, tools


def fake_why_runner_pass0(incident_id, asset_context, evidence_bundle):
    # Produce two hypotheses; leading hypothesis H-1 is plausible
    if isinstance(evidence_bundle, dict) and "evidence" in evidence_bundle:
        evidence_ids = [e["evidence_id"] for e in evidence_bundle["evidence"]]
    elif isinstance(evidence_bundle, list):
        evidence_ids = [e["evidence_id"] for e in evidence_bundle]
    else:
        evidence_ids = []
    return [
        {
            "hypothesis_id": "H-1",
            "description": "Bearing wear leading to increased vibration",
            "status": "LIKELY",
            "confidence": 0.72,
            "supporting_evidence_ids": [evidence_ids[0]] if evidence_ids else [],
            "counter_evidence_ids": [],
            "missing_evidence": ["Direct dial-indicator reading"],
            "next_discriminating_check": "Inspect bearing IR image",
        },
        {
            "hypothesis_id": "H-2",
            "description": "Imbalance in rotor causing rpm anomaly",
            "status": "COMPETING",
            "confidence": 0.45,
            "supporting_evidence_ids": [evidence_ids[-1]] if evidence_ids else [],
            "counter_evidence_ids": [],
            "missing_evidence": [],
            "next_discriminating_check": "Check rotor balance",
        },
    ]


def fake_critic_requests_inspection(incident_id, asset_context, evidence_bundle):
    # Critic identifies missing inspection image and requests get_inspection_image
    evidence_ids = [e["evidence_id"] for e in evidence_bundle["evidence"]]
    return {
        "critic_id": "CRIT-1",
        "target_hypothesis_id": "H-1",
        "contradictions": [],
        "ignored_evidence_ids": [],
        "falsification_check": "Dial indicator runout < 0.02 mm falsifies",
        "most_discriminating_missing_evidence": "inspection_image_ev",
        "confidence_revision": 0.0,
        "request_more_evidence": {"tool": "get_inspection_image", "params": {"incident_id": "INC-2026-0827"}},
    }


def fake_why_runner_pass1(incident_id, asset_context, evidence_bundle):
    # After targeted retrieval, the WHY may increase confidence in H-1
    if isinstance(evidence_bundle, dict) and "evidence" in evidence_bundle:
        evidence_ids = [e["evidence_id"] for e in evidence_bundle["evidence"]]
    elif isinstance(evidence_bundle, list):
        evidence_ids = [e["evidence_id"] for e in evidence_bundle]
    else:
        evidence_ids = []
    return [
        {
            "hypothesis_id": "H-1",
            "description": "Bearing wear leading to increased vibration",
            "status": "SUPPORTED",
            "confidence": 0.92,
            "supporting_evidence_ids": evidence_ids[:3],
            "counter_evidence_ids": [],
            "missing_evidence": [],
            "next_discriminating_check": "",
        },
        {
            "hypothesis_id": "H-2",
            "description": "Imbalance in rotor",
            "status": "COMPETING",
            "confidence": 0.30,
            "supporting_evidence_ids": [evidence_ids[-1]] if evidence_ids else [],
            "counter_evidence_ids": [],
            "missing_evidence": [],
            "next_discriminating_check": "",
        },
    ]


def test_phase3d_targeted_loop_inspection():
    agent, why, critic, tools = make_agent_with_fixture()
    state = InvestigationState(incident_id="INC-2026-0827")
    state.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    # run evidence agent
    state = agent.run(state)
    # initial why
    state = why.run(state, model_runner_override=lambda i, a, b: fake_why_runner_pass0(i, a, b["evidence"]))

    # run critic which requests inspection image
    cf = critic.run(state, leading_hypothesis_id=state.hypotheses[0].hypothesis_id, model_runner_override=lambda i, a, b: fake_critic_requests_inspection(i, a, b))
    assert cf.request_more_evidence and cf.request_more_evidence.get("tool") == "get_inspection_image"

    # perform targeted retrieval and revised WHY via RootOrchestrator flow: we reuse RootOrchestrator.run with model_runner_override mapping
    orchestrator = RootOrchestrator(services={"model_runner_override": lambda i, a, b: fake_why_runner_pass1(i, a, b["evidence"]), "model": None, "tools": tools})
    out = orchestrator.run(state)
    # after revised WHY, confidence for H-1 should be higher
    assert any(h.hypothesis_id == "H-1" and h.confidence and h.confidence > 0.8 for h in out.hypotheses)


def _sequenced_runner(seq):
    """Return a model_runner_override that yields items from seq in order.

    Each item may be a callable(incident_id, asset_context, evidence_bundle)
    or a literal dict/list to return.
    """
    idx = {"i": 0}

    def runner(incident_id, asset_context, evidence_bundle):
        if idx["i"] >= len(seq):
            raise RuntimeError("Model runner called more times than expected")
        out = seq[idx["i"]]
        idx["i"] += 1
        if callable(out):
            return out(incident_id, asset_context, evidence_bundle)
        return out

    return runner


def test_phase3d_a_well_supported_leading_hypothesis():
    """Scenario A: Critic runs but requests no additional evidence; workflow stops."""
    agent, why, critic, tools = make_agent_with_fixture()

    def initial_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {
                "hypothesis_id": "H-1",
                "description": "Well supported cause",
                "status": "SUPPORTED",
                "confidence": 0.95,
                "supporting_evidence_ids": [ev_ids[0]] if ev_ids else [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
            {
                "hypothesis_id": "H-2",
                "description": "Alternate cause",
                "status": "COMPETING",
                "confidence": 0.20,
                "supporting_evidence_ids": [ev_ids[-1]] if ev_ids else [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
        ]

    def critic_no_request(incident_id, asset_context, evidence_bundle):
        return {
            "critic_id": "CRIT-A",
            "target_hypothesis_id": "H-1",
            "contradictions": [],
            "ignored_evidence_ids": [],
            "falsification_check": None,
            "most_discriminating_missing_evidence": None,
            "confidence_revision": None,
            "request_more_evidence": None,
        }

    runner = _sequenced_runner([initial_why, critic_no_request])
    orchestrator = RootOrchestrator(services={"model_runner_override": runner, "model": None, "tools": tools})
    st = InvestigationState(incident_id="INC-2026-0827")
    st.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    out = orchestrator.run(st)

    # No targeted retrieval or revised WHY should have occurred
    assert not any(evt.event_id.startswith("AUD-TARGETED-EVIDENCE") for evt in out.audit_events)
    assert not any(evt.event_id == "AUD-REVISED-WHY-START" for evt in out.audit_events)
    # Critic finding recorded
    assert any(cf.critic_id == "CRIT-A" for cf in out.critic_findings)


def test_phase3d_c_targeted_evidence_unavailable():
    """Scenario C: Critic requests an allowlisted tool but the tool fails (missing).

    Expectation: AUD-TARGETED-EVIDENCE-MISSING recorded, no invented evidence, no second retry.
    """
    agent, why, critic, tools = make_agent_with_fixture()

    def initial_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {
                "hypothesis_id": "H-1",
                "description": "Candidate",
                "status": "LIKELY",
                "confidence": 0.7,
                "supporting_evidence_ids": [ev_ids[0]] if ev_ids else [],
                "counter_evidence_ids": [],
                "missing_evidence": ["inspection_image_ev"],
                "next_discriminating_check": "Inspect image",
            },
            {
                "hypothesis_id": "H-2",
                "description": "Alt",
                "status": "COMPETING",
                "confidence": 0.3,
                "supporting_evidence_ids": [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
        ]

    def critic_requests_inspection(incident_id, asset_context, evidence_bundle):
        return {
            "critic_id": "CRIT-C",
            "target_hypothesis_id": "H-1",
            "contradictions": [],
            "ignored_evidence_ids": [],
            "falsification_check": None,
            "most_discriminating_missing_evidence": "inspection_image_ev",
            "confidence_revision": None,
            "request_more_evidence": {"tool": "get_inspection_image", "params": {"incident_id": "INC-2026-0827"}},
        }

    def revised_why_passthrough(incident_id, asset_context, evidence_bundle):
        # produce a conservative revised WHY that references only existing evidence
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {
                "hypothesis_id": "H-1",
                "description": "Candidate",
                "status": "UNRESOLVED",
                "confidence": 0.5,
                "supporting_evidence_ids": ev_ids[:1],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
            {
                "hypothesis_id": "H-2",
                "description": "Alt",
                "status": "COMPETING",
                "confidence": 0.5,
                "supporting_evidence_ids": ev_ids[-1:],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
        ]

    runner = _sequenced_runner([initial_why, critic_requests_inspection, revised_why_passthrough])

    # create a tools proxy that will fail get_inspection_image to simulate missing evidence
    tools_missing = tools

    def failing_inspection(req):
        raise KeyError("inspection image not found")

    # override instance method
    setattr(tools_missing, "get_inspection_image", failing_inspection)

    orchestrator = RootOrchestrator(services={"model_runner_override": runner, "model": None, "tools": tools_missing})
    st = InvestigationState(incident_id="INC-2026-0827")
    st.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    out = orchestrator.run(st)

    # targeted retrieval should be recorded as MISSING
    assert any(evt.event_id == "AUD-TARGETED-EVIDENCE-MISSING" for evt in out.audit_events)
    # no inspection image evidence should have been appended by the targeted retrieval
    assert not any(getattr(e, "source", "") == "InspectionImage" and e.evidence_id for e in out.evidence)
    # revised WHY attempted exactly once
    assert sum(1 for evt in out.audit_events if evt.event_id == "AUD-REVISED-WHY-START") == 1


def test_phase3d_d_critic_references_unknown_evidence():
    """Scenario D: Critic output references an unknown evidence id -> validation fail."""
    agent, why, critic, tools = make_agent_with_fixture()

    def initial_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {
                "hypothesis_id": "H-1",
                "description": "Candidate",
                "status": "LIKELY",
                "confidence": 0.7,
                "supporting_evidence_ids": [ev_ids[0]] if ev_ids else [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
            {
                "hypothesis_id": "H-2",
                "description": "Alt",
                "status": "COMPETING",
                "confidence": 0.3,
                "supporting_evidence_ids": [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
        ]

    def critic_bad_ref(incident_id, asset_context, evidence_bundle):
        # references unknown evidence id which should trigger validation fail
        return {
            "critic_id": "CRIT-D",
            "target_hypothesis_id": "H-1",
            "contradictions": [{"point": "contrad", "conflicting_evidence_ids": ["NON_EXISTENT_EV"]}],
            "ignored_evidence_ids": [],
            "falsification_check": None,
            "most_discriminating_missing_evidence": None,
            "confidence_revision": None,
            "request_more_evidence": None,
        }

    runner = _sequenced_runner([initial_why, critic_bad_ref])
    orchestrator = RootOrchestrator(services={"model_runner_override": runner, "model": None, "tools": tools})
    st = InvestigationState(incident_id="INC-2026-0827")
    st.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    out = orchestrator.run(st)

    # Critic validation fail audit recorded
    assert any(evt.event_id == "AUD-CRITIC-VALIDATION-FAIL" for evt in out.audit_events)
    # state.hypotheses remain as from initial WHY
    assert len(out.hypotheses) == 2 and out.hypotheses[0].hypothesis_id == "H-1"


def test_phase3d_e_revised_why_references_unknown_evidence():
    """Scenario E: Revised WHY references unknown evidence id -> validation fail and rollback."""
    agent, why, critic, tools = make_agent_with_fixture()

    def initial_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {
                "hypothesis_id": "H-1",
                "description": "Candidate",
                "status": "LIKELY",
                "confidence": 0.7,
                "supporting_evidence_ids": [ev_ids[0]] if ev_ids else [],
                "counter_evidence_ids": [],
                "missing_evidence": ["inspection_image_ev"],
                "next_discriminating_check": "Inspect image",
            },
            {
                "hypothesis_id": "H-2",
                "description": "Alt",
                "status": "COMPETING",
                "confidence": 0.3,
                "supporting_evidence_ids": [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
        ]

    def critic_requests_inspection(incident_id, asset_context, evidence_bundle):
        return {
            "critic_id": "CRIT-E",
            "target_hypothesis_id": "H-1",
            "contradictions": [],
            "ignored_evidence_ids": [],
            "falsification_check": None,
            "most_discriminating_missing_evidence": "inspection_image_ev",
            "confidence_revision": None,
            "request_more_evidence": {"tool": "get_inspection_image", "params": {"incident_id": "INC-2026-0827"}},
        }

    def revised_why_bad_ref(incident_id, asset_context, evidence_bundle):
        # This revised WHY incorrectly references an unknown evidence id
        return [
            {
                "hypothesis_id": "H-1",
                "description": "Candidate",
                "status": "SUPPORTED",
                "confidence": 0.9,
                "supporting_evidence_ids": ["UNKNOWN-EV-1234"],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
            {
                "hypothesis_id": "H-2",
                "description": "Alt",
                "status": "COMPETING",
                "confidence": 0.1,
                "supporting_evidence_ids": [],
                "counter_evidence_ids": [],
                "missing_evidence": [],
                "next_discriminating_check": "",
            },
        ]

    runner = _sequenced_runner([initial_why, critic_requests_inspection, revised_why_bad_ref])
    orchestrator = RootOrchestrator(services={"model_runner_override": runner, "model": None, "tools": tools})
    st = InvestigationState(incident_id="INC-2026-0827")
    st.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    out = orchestrator.run(st)

    # Revised WHY failed and previous hypotheses restored
    assert any(evt.event_id == "AUD-REVISED-WHY-FAIL" for evt in out.audit_events)
    # previous hypotheses (2) present and unchanged
    assert len(out.hypotheses) == 2 and out.hypotheses[0].hypothesis_id == "H-1"


def test_phase3d_f_second_loop_attempt_bound():
    """Scenario F: Ensure only a single targeted retrieval + revised WHY pass is executed."""
    agent, why, critic, tools = make_agent_with_fixture()

    def initial_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {"hypothesis_id": "H-1", "description": "A", "status": "LIKELY", "confidence": 0.7, "supporting_evidence_ids": ev_ids[:1], "counter_evidence_ids": [], "missing_evidence": ["inspection_image_ev"], "next_discriminating_check": "Inspect"},
            {"hypothesis_id": "H-2", "description": "B", "status": "COMPETING", "confidence": 0.3, "supporting_evidence_ids": ev_ids[-1:], "counter_evidence_ids": [], "missing_evidence": [], "next_discriminating_check": ""},
        ]

    def critic_requests_inspection(incident_id, asset_context, evidence_bundle):
        return {"critic_id": "CRIT-F", "target_hypothesis_id": "H-1", "contradictions": [], "ignored_evidence_ids": [], "falsification_check": None, "most_discriminating_missing_evidence": "inspection_image_ev", "confidence_revision": None, "request_more_evidence": {"tool": "get_inspection_image", "params": {"incident_id": "INC-2026-0827"}}}

    def revised_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {"hypothesis_id": "H-1", "description": "A", "status": "SUPPORTED", "confidence": 0.9, "supporting_evidence_ids": ev_ids[:2], "counter_evidence_ids": [], "missing_evidence": [], "next_discriminating_check": ""},
            {"hypothesis_id": "H-2", "description": "B", "status": "COMPETING", "confidence": 0.1, "supporting_evidence_ids": ev_ids[-1:], "counter_evidence_ids": [], "missing_evidence": [], "next_discriminating_check": ""},
        ]

    runner = _sequenced_runner([initial_why, critic_requests_inspection, revised_why])
    orchestrator = RootOrchestrator(services={"model_runner_override": runner, "model": None, "tools": tools})
    st = InvestigationState(incident_id="INC-2026-0827")
    st.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    out = orchestrator.run(st)

    # ensure only one targeted retrieval and one revised WHY
    assert sum(1 for evt in out.audit_events if evt.event_id == "AUD-TARGETED-EVIDENCE-START") == 1
    assert sum(1 for evt in out.audit_events if evt.event_id == "AUD-REVISED-WHY-START") == 1


def test_phase3d_g_contradictory_evidence_changes_confidence():
    """Scenario G: Contradictory targeted evidence leads revised WHY to lower leading hypothesis confidence."""
    agent, why, critic, tools = make_agent_with_fixture()

    def initial_why(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        return [
            {"hypothesis_id": "H-1", "description": "A", "status": "LIKELY", "confidence": 0.8, "supporting_evidence_ids": ev_ids[:1], "counter_evidence_ids": [], "missing_evidence": ["inspection_image_ev"], "next_discriminating_check": "Inspect"},
            {"hypothesis_id": "H-2", "description": "B", "status": "COMPETING", "confidence": 0.4, "supporting_evidence_ids": ev_ids[-1:], "counter_evidence_ids": [], "missing_evidence": [], "next_discriminating_check": ""},
        ]

    def critic_requests_inspection(incident_id, asset_context, evidence_bundle):
        return {"critic_id": "CRIT-G", "target_hypothesis_id": "H-1", "contradictions": [], "ignored_evidence_ids": [], "falsification_check": None, "most_discriminating_missing_evidence": "inspection_image_ev", "confidence_revision": None, "request_more_evidence": {"tool": "get_inspection_image", "params": {"incident_id": "INC-2026-0827"}}}

    def revised_why_lower_confidence(incident_id, asset_context, evidence_bundle):
        ev_ids = [e["evidence_id"] for e in evidence_bundle.get("evidence", [])]
        # after seeing new inspection evidence, H-1 becomes less likely
        return [
            {"hypothesis_id": "H-1", "description": "A", "status": "UNRESOLVED", "confidence": 0.25, "supporting_evidence_ids": ev_ids[:1], "counter_evidence_ids": [], "missing_evidence": [], "next_discriminating_check": ""},
            {"hypothesis_id": "H-2", "description": "B", "status": "LIKELY", "confidence": 0.75, "supporting_evidence_ids": ev_ids[-1:], "counter_evidence_ids": [], "missing_evidence": [], "next_discriminating_check": ""},
        ]

    runner = _sequenced_runner([initial_why, critic_requests_inspection, revised_why_lower_confidence])
    orchestrator = RootOrchestrator(services={"model_runner_override": runner, "model": None, "tools": tools})
    st = InvestigationState(incident_id="INC-2026-0827")
    st.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    out = orchestrator.run(st)

    # leading hypothesis confidence should have decreased compared with initial
    # find initial vs revised by hypothesis id
    # initial confidence was 0.8 for H-1; revised should be lower (0.25)
    assert any(h.hypothesis_id == "H-1" and h.confidence and h.confidence < 0.5 for h in out.hypotheses)
