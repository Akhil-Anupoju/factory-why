from backend.app.adk.workflow import RootOrchestrator
from backend.app.adk.runner import ADKRunner
from backend.app.adk.state import InvestigationState, AssetContext
import pytest


def test_investigation_state_construction_serialization():
    state = InvestigationState(incident_id="INC-2026-0827")
    assert state.incident_id == "INC-2026-0827"
    # add asset context and evidence
    state.asset_context = AssetContext(asset_id="CNC-04", name="CNC-04 5-Axis", model=None, line=None, facility=None)
    state.add_evidence({"evidence_id": "EV-TEST", "source": "test", "timestamp": "2026-01-01T00:00:00Z", "asset": "CNC-04", "component": "X", "observation": "obs"})
    s = state.model_dump()
    assert s["incident_id"] == "INC-2026-0827"


def test_workflow_creation_and_fixture_path():
    orchestrator = RootOrchestrator()
    state = orchestrator.create_initial_state("INC-2026-0827")
    runner = ADKRunner()
    out = runner.run_workflow(orchestrator, state)
    # the placeholder run should add at least the init audit event
    assert len(out.audit_events) >= 1
    assert out.audit_events[0].event_id == "AUD-ADK-INIT"
