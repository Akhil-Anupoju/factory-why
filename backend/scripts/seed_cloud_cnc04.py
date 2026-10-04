#!/usr/bin/env python3
"""
CNC-04 Cloud Seed Preparation CLI

This script prepares a deterministic, explicit, idempotent seed plan for the
CNC-04 demo data. It does NOT write to cloud resources unless --execute is
provided. The default behaviour is a dry-run which prints a compact plan and
summary.

Usage (dry-run):
  ./backend/.venv/bin/python backend/scripts/seed_cloud_cnc04.py --fixture backend/fixtures/cnc04-primary.json

Usage (execute - requires ADC and explicit consent):
  ./backend/.venv/bin/python backend/scripts/seed_cloud_cnc04.py --fixture backend/fixtures/cnc04-primary.json \
    --project factory-why-hackathon --dataset factory_why --table telemetry_raw --execute

This file intentionally avoids importing google.cloud packages during dry-run.
"""

from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

from backend.app.seed.seed_bigquery import build_rows_from_fixture


GCS_URI_RE = re.compile(r"^gcs://([^/]+)/(.+)$")


def discover_gcs_targets(fixture: Dict) -> List[Tuple[str, str]]:
    """Return list of (bucket, path) tuples referenced by fixture evidence provenance."""
    out: List[Tuple[str, str]] = []
    for e in fixture.get("evidence", []):
        prov = e.get("provenance") or ""
        if isinstance(prov, str) and prov.startswith("gcs://"):
            m = GCS_URI_RE.match(prov.split("#", 1)[0])
            if m:
                out.append((m.group(1), m.group(2)))
        # image_url may be a data: URI but provenance is authoritative
    # also consider telemetry provenance strings (not typical for gcs)
    return out


def discover_firestore_targets(fixture: Dict) -> List[str]:
    out = []
    # provenance like firestore://historical_incidents/INC-419_resolved
    for e in fixture.get("evidence", []):
        prov = e.get("provenance") or ""
        if isinstance(prov, str) and prov.startswith("firestore://"):
            out.append(prov[len("firestore://"):])
    return out


def summary_for_dry_run(fixture_path: Path) -> Dict:
    p = Path(fixture_path)
    data = json.loads(p.read_text())
    rows = build_rows_from_fixture(p)

    asset_id = data.get("asset", {}).get("asset_id")
    scenario_id = rows[0]["scenario_id"] if rows else ""
    gcs_targets = discover_gcs_targets(data)
    fs_targets = discover_firestore_targets(data)

    sample = rows[:8]

    return {
        "fixture": str(p),
        "rows_count": len(rows),
        "asset_id": asset_id,
        "scenario_id": scenario_id,
        "sample_rows": sample,
        "gcs_targets": gcs_targets,
        "firestore_targets": fs_targets,
    }


def print_plan_summary(summary: Dict, project: str, dataset: str, table: str, seed_firestore: bool, seed_bigquery: bool, seed_gcs: bool) -> None:
    print("\nCNC-04 CLOUD SEED PREPARATION (DRY-RUN)")
    print("-" * 60)
    print(f"Source fixture: {summary['fixture']}")
    print(f"Target BigQuery: project={project}, dataset={dataset}, table={table}")
    print(f"Planned telemetry rows: {summary['rows_count']}")
    print(f"Asset ID: {summary['asset_id']}")
    print(f"Scenario ID: {summary['scenario_id']}")
    print("")
    print("GCS targets referenced in fixture:")
    if summary["gcs_targets"]:
        for b, p in summary["gcs_targets"]:
            print(f"  - gs://{b}/{p}")
    else:
        print("  (none)")
    print("")
    print("Firestore provenance targets referenced in fixture:")
    if summary["firestore_targets"]:
        for t in summary["firestore_targets"]:
            print(f"  - {t}")
    else:
        print("  (none)")

    print("")
    print("Seed components planned (toggleable):")
    print(f"  - Firestore incident/evidence: {'YES' if seed_firestore else 'NO'}")
    print(f"  - BigQuery telemetry: {'YES' if seed_bigquery else 'NO'}")
    print(f"  - GCS artifacts: {'YES' if seed_gcs else 'NO'}")

    print("\nIdempotency strategy:")
    print("  - Firestore: upsert incident doc (set) and upsert evidence docs by evidence_id (document set). Audit events seeded with fixed doc IDs (event_id) to remain idempotent.")
    print("  - BigQuery: load rows to temp table then MERGE into target on (timestamp, asset_id, sensor_id). This avoids duplicates on reruns.")
    print("  - GCS: upload/overwrite objects (same path) for referenced artifacts; uploading identical content is idempotent.")

    print("\nSample of telemetry rows (first 8):")
    import pprint

    pprint.pprint(summary["sample_rows"])  # readable dump

    print("\nTo execute the seed (writes to cloud), re-run with --execute and appropriate --project/--dataset/--table flags.\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Prepare CNC-04 cloud seed (dry-run or execute)")
    ap.add_argument("--fixture", default="backend/fixtures/cnc04-primary.json", help="Path to fixture JSON")
    ap.add_argument("--project", default="factory-why-hackathon", help="GCP project id")
    ap.add_argument("--dataset", default="factory_why", help="BigQuery dataset")
    ap.add_argument("--table", default="telemetry_raw", help="BigQuery table")
    ap.add_argument("--seed-firestore", action="store_true", help="Also seed Firestore incident + evidence (execute only)")
    ap.add_argument("--seed-bigquery", action="store_true", help="Also seed BigQuery telemetry (execute only)")
    ap.add_argument("--seed-gcs", action="store_true", help="Also seed GCS artifacts (execute only)")
    ap.add_argument("--dry-run", action="store_true", help="Explicit dry-run (no cloud writes). If omitted, default is dry-run unless --execute is provided")
    ap.add_argument("--execute", action="store_true", help="Perform writes to cloud (requires ADC and consent)")
    args = ap.parse_args(argv)

    fixture_path = Path(args.fixture)
    if not fixture_path.exists():
        raise SystemExit(f"fixture not found: {fixture_path}")

    summary = summary_for_dry_run(fixture_path)

    # If both dry-run and execute passed, that's an error
    if args.dry_run and args.execute:
        raise SystemExit("Cannot use --dry-run and --execute together. Choose one.")

    # If no explicit seed flags provided, treat all as planned but dry-run only
    seed_firestore = args.seed_firestore
    seed_bigquery = args.seed_bigquery
    seed_gcs = args.seed_gcs

    # If user set --execute, require explicit seed toggles; otherwise we keep default planned components
    if not any([seed_firestore, seed_bigquery, seed_gcs]):
        # default to all when user didn't provide explicit toggles (but still dry-run unless --execute)
        seed_firestore = True
        seed_bigquery = True
        seed_gcs = True

    print_plan_summary(summary, args.project, args.dataset, args.table, seed_firestore, seed_bigquery, seed_gcs)

    # If user explicitly requested dry-run, stop here.
    if args.dry_run or not args.execute:
        print("DRY-RUN complete. No cloud writes performed. If you want to perform the actual seed, re-run with --execute and the appropriate --seed-* flags.")
        return

    # Execute path (STOP: we will not actually run writes in this tool unless user explicitly calls with --execute)
    # NOTE: we still avoid performing writes automatically in earlier phases. This block is intentionally
    # structured but will be gated behind --execute. We also recommend the operator run with ADC set.
    print("Execute requested. Preparing to connect to GCP clients (will perform writes).")
    print("You requested: Firestore=%s BigQuery=%s GCS=%s" % (seed_firestore, seed_bigquery, seed_gcs))

    # Connect to cloud clients lazily
    try:
        from google.cloud import firestore, bigquery, storage
    except Exception as ex:
        raise SystemExit(f"google-cloud packages required to execute seed: {ex}")

    # Build clients
    fs_client = firestore.Client(project=args.project)
    bq_client = bigquery.Client(project=args.project)
    st_client = storage.Client(project=args.project)

    # Firestore seeding
    if seed_firestore:
        print("Seeding Firestore: upserting incident and evidence documents (idempotent set)...")
        data = json.loads(fixture_path.read_text())
        incident_id = data.get("incident_id")
        # Upsert incident doc (store doc without duplicating evidence/audit arrays to keep doc lean)
        incident_copy = {k: v for k, v in data.items() if k not in ("evidence", "audit_trail")}
        fs_client.collection("incidents").document(incident_id).set(incident_copy)

        # Upsert evidence documents under incidents/{incident_id}/evidence/{evidence_id}
        for e in data.get("evidence", []):
            eid = e.get("evidence_id")
            fs_client.collection("incidents").document(incident_id).collection("evidence").document(eid).set(e)

        # Upsert audit events by event_id to keep idempotent
        for a in data.get("audit_trail", []):
            eid = a.get("event_id") or f"audit-{a.get('timestamp','unknown')}"
            fs_client.collection("incidents").document(incident_id).collection("audit").document(eid).set(a)

        print("Firestore seed completed (upsert semantics used).")

    # BigQuery seeding
    if seed_bigquery:
        print("Seeding BigQuery telemetry (idempotent MERGE). This may incur charges.")
        rows = build_rows_from_fixture(fixture_path)
        from backend.app.seed.seed_bigquery import seed_telemetry_to_bigquery

        res = seed_telemetry_to_bigquery(rows, bq_client, project=args.project, dataset=args.dataset, table=args.table)
        print("BigQuery seed result:", res)

    # GCS seeding
    if seed_gcs:
        print("Seeding GCS artifacts referenced by fixture (upload/overwrite).")
        data = json.loads(fixture_path.read_text())
        targets = discover_gcs_targets(data)
        for bucket, path in targets:
            # create placeholder content when we don't have an actual file
            content = b"Factory WHY placeholder content generated by seed script."
            content_type = "application/octet-stream"
            # special-case inspection image if present in evidence
            # find evidence whose provenance matches this bucket/path
            matching = [e for e in data.get("evidence", []) if (e.get("provenance") or "").startswith(f"gcs://{bucket}/{path}")]
            if matching:
                ev = matching[0]
                img = ev.get("image_url")
                if isinstance(img, str) and img.startswith("data:"):
                    # data URI - extract mimetype and payload (assume utf-8, no base64)
                    try:
                        header, payload = img.split(",", 1)
                        # header like data:image/svg+xml;utf8
                        mime = header.split(";", 1)[0][5:]
                        content = payload.encode("utf-8")
                        content_type = mime or content_type
                    except Exception:
                        pass
                else:
                    # fall back to placeholder
                    content = b"placeholder artifact"

            # upload
            bucket_obj = st_client.bucket(bucket)
            blob = bucket_obj.blob(path)
            blob.upload_from_string(content, content_type=content_type)
            print(f"Uploaded gs://{bucket}/{path} (content_type={content_type})")

    print("CLOUD SEED: Done.")


if __name__ == "__main__":
    main()
