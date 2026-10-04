import json

from backend.app.seed.seed_bigquery import build_rows_from_fixture, seed_telemetry_to_bigquery


def test_build_rows_from_fixture_counts_and_sample():
    rows = build_rows_from_fixture("backend/fixtures/cnc04-primary.json")
    assert isinstance(rows, list)
    # Fixture contains 12 time points x 5 sensors = 60 rows
    assert len(rows) == 60

    first = rows[0]
    assert first["sensor_id"] == "VIB-B04"
    assert first["unit"] == "mm/s RMS"
    assert first["quality"] == "GOOD_CERTIFIED"


def test_seed_telemetry_dry_run_does_not_call_client_methods():
    rows = build_rows_from_fixture("backend/fixtures/cnc04-primary.json")

    class DummyClient:
        def load_table_from_json(self, *args, **kwargs):
            raise AssertionError("load_table_from_json should not be called during dry_run")

        def query(self, *args, **kwargs):
            raise AssertionError("query should not be called during dry_run")

        def delete_table(self, *args, **kwargs):
            raise AssertionError("delete_table should not be called during dry_run")

    result = seed_telemetry_to_bigquery(rows, DummyClient(), project="p", dataset="d", table="t", dry_run=True)
    assert result["dry_run"] is True
    assert result["rows_planned"] == len(rows)
    assert isinstance(result["sample"], list)
    assert len(result["sample"]) <= 5


def test_seed_telemetry_executes_load_merge_and_delete():
    rows = build_rows_from_fixture("backend/fixtures/cnc04-primary.json")[:5]

    class FakeJob:
        def result(self):
            return None

    class FakeClient:
        def __init__(self):
            self.loaded = None
            self.queries = []
            self.deleted = []

        def load_table_from_json(self, rows_arg, table_ref_arg, job_config=None):
            # record what we were asked to load and return a fake job
            self.loaded = {"rows": rows_arg, "table": table_ref_arg, "job_config": job_config}
            return FakeJob()

        def query(self, sql):
            self.queries.append(sql)
            return FakeJob()

        def delete_table(self, table_ref, not_found_ok=False):
            self.deleted.append({"table_ref": table_ref, "not_found_ok": not_found_ok})

    client = FakeClient()
    project = "projx"
    dataset = "dsx"
    table = "telemetry_raw"
    temp_table = "telemetry_seed_tmp"

    res = seed_telemetry_to_bigquery(rows, client, project=project, dataset=dataset, table=table, dry_run=False, temp_table=temp_table)

    assert res.get("status") == "ok"
    assert res.get("rows_loaded") == len(rows)

    assert client.loaded is not None
    assert client.loaded["rows"] == rows

    # One merge query executed
    assert len(client.queries) == 1
    sql = client.queries[0]
    assert f"MERGE `{project}.{dataset}.{table}`" in sql
    assert f"USING `{project}.{dataset}.{temp_table}`" in sql

    # Temp table deletion requested
    assert len(client.deleted) == 1
    assert client.deleted[0]["table_ref"] == f"{project}.{dataset}.{temp_table}"
    assert client.deleted[0]["not_found_ok"] is True
