from __future__ import annotations
from typing import List, Dict, Any, Optional
try:
    from google.cloud import bigquery

    class BigQueryTelemetryRepo:
        def __init__(self, client: bigquery.Client, dataset: str = "factory_why", table: str = "telemetry_raw"):
            self.client = client
            self.dataset = dataset
            self.table = table

        def query_telemetry(self, asset_id: str, limit: int = 100) -> List[Dict[str, Any]]:
            # Simple safe parameterized query
            q = f"SELECT timestamp, sensor_id, asset_id, value, unit, quality, scenario_id FROM `{self.client.project}.{self.dataset}.{self.table}` WHERE asset_id = @asset_id ORDER BY timestamp DESC LIMIT @limit"
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("asset_id", "STRING", asset_id),
                    bigquery.ScalarQueryParameter("limit", "INT64", limit),
                ]
            )
            query_job = self.client.query(q, job_config=job_config)
            rows = list(query_job.result())
            out = []
            for r in rows:
                out.append({
                    "timestamp": r[0],
                    "sensor_id": r[1],
                    "asset_id": r[2],
                    "value": r[3],
                    "unit": r[4],
                    "quality": r[5],
                    "scenario_id": r[6],
                })
            return out
except Exception:
    class BigQueryTelemetryRepo:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("BigQueryTelemetryRepo requires google-cloud-bigquery package")
