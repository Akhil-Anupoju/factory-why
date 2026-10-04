from __future__ import annotations
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime


def _map_sensor_keys(asset: Dict[str, Any]) -> Dict[str, str]:
    # Build mapping from telemetry series keys to sensor_id by inspecting asset components
    # Fallback to conventional names if not found
    sensor_ids: List[str] = []
    for c in asset.get("components", []):
        sensor_ids.extend(c.get("sensor_ids", []))

    def find(prefix: str, fallback: str):
        for s in sensor_ids:
            if prefix.lower() in s.lower():
                return s
        return fallback

    return {
        "vibration": find("vib", "VIB-UNKNOWN"),
        "temperature": find("temp", "TEMP-UNKNOWN"),
        "motor_current": find("curr", "CURR-UNKNOWN"),
        "rpm": find("rpm", "RPM-UNKNOWN"),
        "pressure": find("press", "PRESS-UNKNOWN"),
    }


def _unit_map(telemetry_summary: Dict[str, Any]) -> Dict[str, str]:
    out = {}
    for k, v in telemetry_summary.items():
        if isinstance(v, dict) and "unit" in v:
            out[k] = v["unit"]
    return out


def build_rows_from_fixture(fixture_path: Path | str) -> List[Dict[str, Any]]:
    p = Path(fixture_path)
    if not p.exists():
        raise FileNotFoundError(p)
    data = json.loads(p.read_text())

    asset = data.get("asset", {})
    asset_id = asset.get("asset_id")
    mapping = _map_sensor_keys(asset)
    units = _unit_map(data.get("telemetry_summary", {}))

    rows: List[Dict[str, Any]] = []
    for point in data.get("telemetry_series", []):
        ts = point.get("timestamp")
        if not ts:
            continue
        # scenario_id: use telemetry_raw/sensors/{asset_id}/partition_YYYYMMDD to match provenance
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            partition = dt.strftime("%Y%m%d")
        except Exception:
            partition = "unknown"

        scenario_id = f"telemetry_raw/sensors/{asset_id}/partition_{partition}"

        # for each measurement key, create a row
        measurements = {
            "vibration": point.get("vibration"),
            "temperature": point.get("temperature"),
            "motor_current": point.get("motor_current"),
            "rpm": point.get("rpm"),
            "pressure": point.get("pressure"),
        }

        for key, val in measurements.items():
            if val is None:
                continue
            sensor_id = mapping.get(key)
            unit = units.get(key) or ""
            quality = "ANOMALOUS" if point.get("is_anomalous") else "GOOD_CERTIFIED"

            row = {
                "timestamp": ts,
                "asset_id": asset_id,
                "sensor_id": sensor_id,
                "value": float(val),
                "unit": unit,
                "quality": quality,
                "scenario_id": scenario_id,
            }
            rows.append(row)

    return rows


def seed_telemetry_to_bigquery(
    rows: List[Dict[str, Any]],
    client,
    project: str,
    dataset: str,
    table: str,
    dry_run: bool = False,
    temp_table: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Seed telemetry rows into BigQuery in an idempotent way.

    Approach:
    - Load rows into a temporary table (WRITE_TRUNCATE).
    - MERGE temp table into target table on (timestamp, asset_id, sensor_id) and
      INSERT when not matched. This prevents duplicate inserts on repeated runs.
    """
    from google.cloud import bigquery

    job_summary: Dict[str, Any] = {"inserted": 0, "skipped": 0}

    if dry_run:
        return {"dry_run": True, "rows_planned": len(rows), "sample": rows[:5]}

    ds_ref = f"{project}.{dataset}"
    target_table_ref = f"{project}.{dataset}.{table}"
    temp_table_name = temp_table or f"{table}_seed_temp"
    temp_table_ref = f"{project}.{dataset}.{temp_table_name}"

    # Build schema
    schema = [
        bigquery.SchemaField("timestamp", "TIMESTAMP"),
        bigquery.SchemaField("asset_id", "STRING"),
        bigquery.SchemaField("sensor_id", "STRING"),
        bigquery.SchemaField("value", "FLOAT"),
        bigquery.SchemaField("unit", "STRING"),
        bigquery.SchemaField("quality", "STRING"),
        bigquery.SchemaField("scenario_id", "STRING"),
    ]

    # 1) load rows into temp table using load_table_from_json (WRITE_TRUNCATE)
    table_ref = bigquery.Table(bigquery.TableReference.from_string(temp_table_ref))
    table_ref.schema = schema

    job = client.load_table_from_json(rows, table_ref, job_config=bigquery.LoadJobConfig(schema=schema, write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE))
    job.result()  # wait

    # 2) MERGE into target table: insert rows that don't exist
    merge_sql = f"""
    MERGE `{target_table_ref}` T
    USING `{temp_table_ref}` S
    ON T.timestamp = S.timestamp AND T.asset_id = S.asset_id AND T.sensor_id = S.sensor_id
    WHEN NOT MATCHED BY TARGET THEN
      INSERT (timestamp, asset_id, sensor_id, value, unit, quality, scenario_id)
      VALUES(S.timestamp, S.asset_id, S.sensor_id, S.value, S.unit, S.quality, S.scenario_id)
    """

    query_job = client.query(merge_sql)
    query_job.result()

    # 3) Optionally delete temp table
    client.delete_table(temp_table_ref, not_found_ok=True)

    return {"status": "ok", "rows_loaded": len(rows)}
