from backend.app.tools.tool_impl import (
    AllowlistedTools,
    AssetContextRequest,
    TelemetryWindowRequest,
    MaintenanceHistoryRequest,
    SearchManualRequest,
    PriorIncidentsRequest,
    InspectionImageRequest,
)
from backend.app.repositories.in_memory import (
    InMemoryIncidentRepo,
    InMemoryEvidenceRepo,
    InMemoryAuditRepo,
    InMemoryTelemetryRepo,
    InMemoryStorageRepo,
)
from backend.app.seed.seed_from_fixture import seed_from_fixture
import pytest


def make_tools_with_fixture():
    inc = InMemoryIncidentRepo()
    ev = InMemoryEvidenceRepo()
    au = InMemoryAuditRepo()
    te = InMemoryTelemetryRepo()
    st = InMemoryStorageRepo()
    seed_from_fixture(inc, ev, au, fixture_path="backend/fixtures/cnc04-primary.json")
    # seed telemetry rows from fixture telemetry_series into telemetry repo
    data_inc = inc.get_incident("INC-2026-0827")
    for row in data_inc.get("telemetry_series", []):
        # For EvidenceService normalization we need sensor_id/value fields.
        # Create one telemetry row per channel with sensor_id matching fixture sensors.
        asset_id = data_inc.get("asset", {}).get("asset_id")
        channel_map = [
            ("VIB-B04", "vibration"),
            ("TEMP-B04", "temperature"),
            ("CURR-M01", "motor_current"),
            ("RPM-S01", "rpm"),
            ("PRESS-HYD01", "pressure"),
        ]
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

    # seed a storage metadata entry for the inspection image path
    st.put_metadata("incidents/INC-2026-0827/inspection_ir_optical_b04.jpg", {"size": 345678, "contentType": "image/jpeg"})

    # create evidence service
    from backend.app.services.evidence_service import EvidenceService

    svc = EvidenceService(inc, ev, au, te, st)
    tools = AllowlistedTools(inc, ev, te, st, svc)
    return tools


def test_get_asset_context_success():
    tools = make_tools_with_fixture()
    resp = tools.get_asset_context({"asset_id": "CNC-04"})
    assert resp.asset_id == "CNC-04"
    assert "CNC-04" in resp.name


def test_get_asset_context_missing():
    tools = make_tools_with_fixture()
    with pytest.raises(KeyError):
        tools.get_asset_context({"asset_id": "NOPE"})


def test_get_telemetry_window_success():
    tools = make_tools_with_fixture()
    resp = tools.get_telemetry_window({"asset_id": "CNC-04"})
    assert len(resp.points) >= 1
    assert resp.points[0].timestamp.startswith("2026-09-22T")


def test_get_maintenance_history():
    tools = make_tools_with_fixture()
    resp = tools.get_maintenance_history({"asset_id": "CNC-04"})
    # fixture contains a maintenance work order EV-1042
    assert any(w.evidence_id == "EV-1042" for w in resp.work_orders)


def test_search_manual_found_and_empty():
    tools = make_tools_with_fixture()
    # existing term from manual
    resp = tools.search_manual({"query": "spindle", "asset_id": "CNC-04", "max_results": 5})
    assert isinstance(resp.results, list)
    # there should be matches for 'spindle' in the service manual evidence
    assert len(resp.results) >= 1
    # query with no hits
    resp2 = tools.search_manual({"query": "nope-foobar", "max_results": 5})
    assert resp2.results == []


def test_get_prior_incidents():
    tools = make_tools_with_fixture()
    resp = tools.get_prior_incidents({"asset_id": "CNC-04", "limit": 5})
    assert isinstance(resp.incidents, list)
    # there is at least the current incident present
    assert any(i.incident_id == "INC-2026-0827" for i in resp.incidents)


def test_get_inspection_image_success_and_missing():
    tools = make_tools_with_fixture()
    resp = tools.get_inspection_image({"incident_id": "INC-2026-0827"})
    assert resp.evidence_id == "EV-1045"
    assert resp.storage_metadata is not None and resp.storage_metadata.get("size")

    with pytest.raises(KeyError):
        tools.get_inspection_image({"incident_id": "NOPE"})
