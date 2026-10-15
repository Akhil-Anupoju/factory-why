from backend.app.seed.test_incident_fixtures import build_fresh_replay_incident, build_test_incidents


def test_test_incident_fixtures_are_distinct_and_start_fresh():
    incidents = build_test_incidents()

    assert [incident["incident_id"] for incident in incidents] == [
        "INC-2026-0902",
        "INC-2026-0915",
        "INC-2026-0928",
        "INC-2026-0938",
        "INC-2026-0951",
        "INC-2026-0964",
        "INC-2026-0977",
        "INC-2026-1115",
        "INC-2026-1128",
        "INC-2026-1141",
    ]
    for incident in incidents:
        assert incident["approval"]["decision"] == "PENDING"
        assert incident["action"] is None
        assert incident["outcome"] is None
        assert incident["audit_trail"] == []
        assert incident["evidence"]
        assert len(incident["telemetry_series"]) == 12
        assert sum(bool(point.get("is_anomalous")) for point in incident["telemetry_series"]) == 5
        for metric in ("vibration", "temperature", "motor_current", "rpm", "pressure"):
            assert incident["telemetry_series"][-1][metric] == incident["telemetry_summary"][metric]["current"]
        assert all(item["incident_id"] == incident["incident_id"] for item in incident["evidence"])
        evidence_ids = {item["evidence_id"] for item in incident["evidence"]}
        assert all(set(hypothesis["supporting_evidence_ids"]) <= evidence_ids for hypothesis in incident["hypotheses"])


def test_fresh_replay_incident_matches_complete_contract_and_is_reset():
    incident = build_fresh_replay_incident()

    assert incident["incident_id"] == "INC-2026-1001"
    assert isinstance(incident["telemetry_series"], list) and incident["telemetry_series"]
    assert isinstance(incident["evidence"], list) and incident["evidence"]
    assert isinstance(incident["audit_trail"], list) and incident["audit_trail"] == []
    assert incident["approval"]["decision"] == "PENDING"
    assert incident["approval"]["incident_id"] == incident["incident_id"]
    assert incident["approval"]["recommendation_id"] == incident["recommendation"]["recommendation_id"]
    assert incident["action"] is None
    assert incident["outcome"] is None

    second = build_fresh_replay_incident("INC-2026-1002")
    assert second["incident_id"] == "INC-2026-1002"
    assert second["approval"]["recommendation_id"] == second["recommendation"]["recommendation_id"]
    assert all(item["incident_id"] == second["incident_id"] for item in second["evidence"])


def test_two_additional_test_incidents_have_complete_contracts():
    by_id = {incident["incident_id"]: incident for incident in build_test_incidents()}
    for incident_id in ("INC-2026-0938", "INC-2026-0951"):
        incident = by_id[incident_id]
        assert incident["telemetry_series"]
        assert incident["evidence"]
        assert incident["audit_trail"] == []
        assert incident["approval"]["decision"] == "PENDING"
        assert incident["action"] is None
        assert incident["outcome"] is None
