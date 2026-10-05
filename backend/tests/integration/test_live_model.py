import os
import pytest
import time

pytestmark = pytest.mark.skipif(
    not os.getenv("FACTORY_WHY_LIVE_MODEL_TESTS"),
    reason="Live model tests are opt-in. Set FACTORY_WHY_LIVE_MODEL_TESTS=1 to run",
)


def _has_adc_and_vertex():
    # quick check: google.adk must be importable and ADK_MODEL_PROVIDER must be vertex_ai
    try:
        import google.adk  # noqa: F401
    except Exception:
        return False, "google.adk not importable"
    provider = os.getenv("ADK_MODEL_PROVIDER")
    model = os.getenv("ADK_MODEL_NAME")
    if (provider or "").lower() != "vertex_ai":
        return False, "ADK_MODEL_PROVIDER != vertex_ai"
    if not model:
        return False, "ADK_MODEL_NAME not set"
    # If we're targeting Vertex AI, prefer the ADK/genai runtime to be
    # explicitly configured to use Enterprise/Vertex via ADC. Newer ADK
    # versions honor GOOGLE_GENAI_USE_ENTERPRISE; fall back to the older
    # GOOGLE_GENAI_USE_VERTEXAI for compatibility.
    if os.getenv("GOOGLE_GENAI_USE_ENTERPRISE") not in ("1", "true", "True") and os.getenv("GOOGLE_GENAI_USE_VERTEXAI") not in ("1", "true", "True"):
        return False, "GOOGLE_GENAI_USE_ENTERPRISE or GOOGLE_GENAI_USE_VERTEXAI not set (recommended)"
    return True, "ok"


def test_live_why_and_critic_integration():
    # Ensure ADC/ADK available
    ok, msg = _has_adc_and_vertex()
    if not ok:
        pytest.skip(f"Skipping live model tests: {msg}")

    # Compose cloud repos and run full orchestrator with live model runner
    from backend.app.config import get_settings
    from backend.app.repositories.cloud_repo_factory import create_cloud_repos
    from backend.app.adk import ADKRunner, RootOrchestrator
    from backend.app.adk.state import InvestigationState

    settings = get_settings()
    inc_repo, ev_repo, au_repo, te_repo, st_repo = create_cloud_repos(
        settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket
    )

    # services: provide cloud tools to orchestrator so EvidenceAgent reads real data
    from backend.app.tools.tool_impl import AllowlistedTools
    from backend.app.services.evidence_service import EvidenceService

    svc = EvidenceService(inc_repo, ev_repo, au_repo, te_repo, st_repo)
    tools = AllowlistedTools(inc_repo, ev_repo, te_repo, st_repo, svc)

    # boot runner which will attach model_runner_override when FACTORY_WHY_LIVE_MODEL_TESTS is set
    runner = ADKRunner(services={})
    orchestrator = RootOrchestrator(services={"tools": tools})

    # create state for the real CNC-04 incident
    state = orchestrator.create_initial_state("INC-2026-0827")

    # run workflow via ADKRunner (this will attach model_runner_override when enabled)
    start = time.time()
    state = runner.run_workflow(orchestrator, state)
    duration = time.time() - start

    # TEMP DIAGNOSTICS: print safe audit metadata for debugging
    print("\n=== LIVE WHY DIAGNOSTICS ===")
    print(f"evidence_count = {len(state.evidence)}")
    print(f"hypotheses_count = {len(state.hypotheses)}")
    print(f"duration = {duration:.1f}s")
    print("Relevant audit events:")
    for a in state.audit_events:
        if a.event_id.startswith("AUD-MODEL") or a.event_id.startswith("AUD-WHY") or a.event_id.startswith("AUD-LOOP"):
            # Print a compact, safe summary of the audit event
            rp = a.response_payload or {}
            safe_rp = {k: (v if (isinstance(v, (str, int, float, bool)) or v is None) else str(type(v).__name__)) for k, v in rp.items()} if isinstance(rp, dict) else str(type(rp).__name__)
            print(f"- {a.event_id} | {a.summary} | step={a.step_number} | status={a.status} | response_payload_keys={list(rp.keys()) if isinstance(rp, dict) else None}")
            # If model diagnostics present, show them explicitly
            if a.event_id.startswith("AUD-MODEL-DIAG") and isinstance(rp, dict):
                print(f"  model_diag: json_parse_succeeded={rp.get('json_parse_succeeded')} text_length={rp.get('text_length')} list_length={rp.get('list_length')} parse_exception={rp.get('parse_exception')}")
                if rp.get('first_200_chars'):
                    print(f"  first_200_chars: {rp.get('first_200_chars')}")
            # If WHY failed, print the error message (safe)
            if a.event_id == "AUD-WHY-FAIL" and isinstance(rp, dict) and rp.get('error'):
                err = rp.get('error')
                # truncate to avoid leaking large content
                if isinstance(err, str):
                    print(f"  why_error: {err[:800]}")
    print("=== END DIAGNOSTICS ===\n")

    # Verify WHY produced hypotheses (validation performed by WhyAgent)
    assert len(state.hypotheses) >= 2, "Expected 2+ hypotheses from live WHY"

    # Validate grounding: all referenced evidence IDs must exist
    evidence_ids = {e.evidence_id for e in state.evidence}
    for h in state.hypotheses:
        for eid in (h.supporting_evidence_ids or []) + (h.counter_evidence_ids or []):
            assert eid in evidence_ids, f"Hypothesis references unknown evidence id: {eid}"

    # NOTE: numeric content validation replaced by grounded-check in later phases.

    # Confirm we recorded model audit entries
    audit_ids = [a.event_id for a in state.audit_events]
    assert any(s.startswith("AUD-MODEL") for s in audit_ids), "Model audit events missing"

    # basic smoke check for critic: we expect either critic findings or no critic (critic may fail validation)
    # The RootOrchestrator runs Critic if model_runner provided and hypotheses exist. Ensure audit present.
    assert any("AUD-LOOP-STOP" == a.event_id for a in state.audit_events), "Workflow loop stop audit missing"
