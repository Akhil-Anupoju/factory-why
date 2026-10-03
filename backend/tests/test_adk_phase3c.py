from backend.app.adk.workflow import RootOrchestrator
from backend.app.adk.evidence_agent import EvidenceAgent
from backend.app.adk.why_agent import WhyAgent
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
from backend.app.adk.state import EvidenceBundle
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
    return agent, why, tools


def fake_model_runner(incident_id, asset_context, evidence_bundle):
    # Return two deterministic hypotheses referencing evidence ids from the bundle
    # evidence_bundle may be either an EvidenceBundle dict or a list; accept both
    if isinstance(evidence_bundle, dict) and "evidence" in evidence_bundle:
        evidence_ids = [e["evidence_id"] for e in evidence_bundle["evidence"]]
    elif isinstance(evidence_bundle, list):
        evidence_ids = [e["evidence_id"] for e in evidence_bundle]
    else:
        evidence_ids = []
    # choose up to 2 evidence ids for support
    sup = evidence_ids[:2]
    return [
        {
            "hypothesis_id": "H-1",
            "description": "Bearing wear leading to increased vibration",
            "status": "LIKELY",
            "confidence": 0.72,
            "supporting_evidence_ids": sup,
            "counter_evidence_ids": [],
            "missing_evidence": [],
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


def test_phase3c_end_to_end():
    agent, why, tools = make_agent_with_fixture()
    state = InvestigationState(incident_id="INC-2026-0827")
    state.asset_context = AssetContext(asset_id="CNC-04", name=None, model=None, line=None, facility=None)
    # run evidence agent
    state = agent.run(state)
    bundle = state.build_evidence_bundle()
    # run why agent with fake model runner
    state = why.run(state, model_runner_override=lambda i, a, b: fake_model_runner(i, a, b["evidence"]))
    # Ensure we have hypotheses
    assert len(state.hypotheses) >= 1
    # every hypothesis must have supporting evidence ids that exist in state.evidence
    ev_ids = {e.evidence_id for e in state.evidence}
    for h in state.hypotheses:
        for sid in h.supporting_evidence_ids:
            assert sid in ev_ids
