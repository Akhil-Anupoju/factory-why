import os
import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("GCP_INTEGRATION_TESTS"),
    reason="GCP integration tests not enabled (set GCP_INTEGRATION_TESTS=1 to run)"
)

def test_firestore_roundtrip_read_write():
    from backend.app.repositories.cloud_repo_factory import create_cloud_repos
    from backend.app.config import get_settings

    settings = get_settings()
    inc_repo, ev_repo, au_repo, te_repo, st_repo = create_cloud_repos(
        settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket
    )

    test_id = "INTEGRATION-TEST-INCIDENT"
    incident = {"incident_id": test_id, "asset": {"asset_id": "TEST-ASSET"}}
    inc_repo.upsert_incident(incident)
    fetched = inc_repo.get_incident(test_id)
    assert fetched is not None and fetched.get("incident_id") == test_id

def test_bigquery_query():
    from backend.app.repositories.cloud_repo_factory import create_cloud_repos
    from backend.app.config import get_settings

    settings = get_settings()
    inc_repo, ev_repo, au_repo, te_repo, st_repo = create_cloud_repos(
        settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket
    )

    # Call telemetry query; do not assert on data presence — only that call succeeds
    rows = te_repo.query_telemetry(asset_id="TEST-ASSET", limit=1)
    assert isinstance(rows, list)

def test_gcs_list_objects():
    from backend.app.repositories.cloud_repo_factory import create_cloud_repos
    from backend.app.config import get_settings

    settings = get_settings()
    inc_repo, ev_repo, au_repo, te_repo, st_repo = create_cloud_repos(
        settings.gcp_project, settings.bigquery_dataset, settings.bigquery_table, settings.gcs_bucket
    )

    objs = st_repo.list_objects(prefix="/")
    assert isinstance(objs, list)
