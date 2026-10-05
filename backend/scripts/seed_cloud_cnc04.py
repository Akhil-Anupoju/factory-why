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
import os


def _parse_data_uri(img: str):
    """Return (mimetype, payload_bytes) for a data: URI or (None, None)."""
    if not isinstance(img, str) or not img.startswith("data:"):
        return None, None
    try:
        header, payload = img.split(",", 1)
        # header like data:image/svg+xml;utf8 or data:image/png;base64
        mime = header.split(";", 1)[0][5:]
        # If base64 encoded, decode; otherwise treat as utf-8 text
        if ";base64" in header:
            import base64

            return mime, base64.b64decode(payload)
        else:
            return mime, payload.encode("utf-8")
    except Exception:
        return None, None


def _ext_for_mime(mime: str) -> str:
    if not mime:
        return ""
    mapping = {
        "image/svg+xml": ".svg",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "application/pdf": ".pdf",
    }
    return mapping.get(mime, "")


def build_gcs_plan(fixture: Dict, dest_bucket: str, upload_placeholders: bool = False) -> List[Dict]:
    """Build a plan describing desired uploads. Does not perform any IO.

    Each plan item is a dict with keys:
      - evidence_id
      - source_provenance (original gcs://... value)
      - source_bucket
      - source_path
      - dest_bucket
      - dest_path
      - content_type (None if not known)
      - has_source_content (True if data: URI present)
      - will_upload (True if upload planned given upload_placeholders flag)
      - note (human text)
    """
    out: List[Dict] = []
    incident_id = fixture.get("incident_id") or ""

    for e in fixture.get("evidence", []):
        prov = e.get("provenance") or ""
        if not (isinstance(prov, str) and prov.startswith("gcs://")):
            continue
        # strip fragment (#page=...)
        base = prov.split("#", 1)[0]
        m = GCS_URI_RE.match(base)
        if not m:
            continue
        src_bucket = m.group(1)
        src_path = m.group(2)
        evidence_id = e.get("evidence_id") or ""

        # choose basename for storage and preserve path under evidence namespace for idempotency
        # dest path: seeded/{incident_id}/{evidence_id}/{src_path}
        safe_src_path = src_path.lstrip("/")
        if incident_id:
            dest_path = os.path.join("seeded", incident_id, evidence_id, safe_src_path)
        else:
            dest_path = os.path.join("seeded", evidence_id, safe_src_path)

        # determine if we have inline content
        img = e.get("image_url")
        mime, payload = _parse_data_uri(img) if isinstance(img, str) else (None, None)
        has_content = bool(mime and payload)
        content_type = mime if has_content else None

        # extension correction: if content_type suggests different extension, change dest_path ext
        ext = _ext_for_mime(content_type) if content_type else ""
        if ext:
            base_root, base_ext = os.path.splitext(dest_path)
            # replace extension with ext (if base_ext differs)
            if base_ext.lower() != ext:
                dest_path = base_root + ext

        will_upload = has_content or bool(upload_placeholders)
        note = "data URI" if has_content else ("placeholder" if upload_placeholders else "provenance-only")

        out.append({
            "evidence_id": evidence_id,
            "source_provenance": prov,
            "source_bucket": src_bucket,
            "source_path": src_path,
            "dest_bucket": dest_bucket,
            "dest_path": dest_path.replace("\\\\", "/"),
            "content_type": content_type or ("application/octet-stream" if upload_placeholders else None),
            "has_source_content": has_content,
            "will_upload": will_upload and dest_bucket is not None,
            "note": note,
        })
    return out


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
    ap.add_argument("--gcs-bucket", default=None, help="Destination GCS bucket to store seeded artifacts. If provided, all seeded artifacts are written into this bucket under a seeded/ prefix. Default: use source buckets from the fixture (legacy).")
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

    # If user requested a dry-run summary but wishes to see the GCS mapping plan, show it
    if args.gcs_bucket:
        plan = build_gcs_plan(json.loads(fixture_path.read_text()), args.gcs_bucket, upload_placeholders=False)
        if plan:
            print("\nGCS SEED PLAN (mapped to --gcs-bucket)")
            for p in plan:
                print(f"- EVIDENCE: {p['evidence_id']}")
                print(f"  SOURCE: {p['source_provenance']}")
                print(f"  DEST: gs://{p['dest_bucket']}/{p['dest_path']}")
                print(f"  CONTENT-TYPE: {p['content_type']}")
                print(f"  HAS_SOURCE_CONTENT: {p['has_source_content']}")
                print(f"  WILL_UPLOAD: {p['will_upload']} ({p['note']})\n")
        else:
            print("\nGCS SEED PLAN: no gcs targets found in fixture.")

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
        # We will preserve existing provenance and add an additive storage_location field
        for e in data.get("evidence", []):
            eid = e.get("evidence_id")
            # Do not mutate original fixture object; create a shallow copy for storage
            e_copy = dict(e)
            # If we've already mapped/seeded GCS artifacts, attach storage_location to evidence
            # Build a plan mapping if gcs plan exists
            if args.gcs_bucket:
                plan = build_gcs_plan(data, args.gcs_bucket, upload_placeholders=False)
                match = next((p for p in plan if p["evidence_id"] == eid), None)
                if match and match.get("will_upload"):
                    e_copy["storage_location"] = f"gs://{match['dest_bucket']}/{match['dest_path']}"

            fs_client.collection("incidents").document(incident_id).collection("evidence").document(eid).set(e_copy)

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
        print("Seeding GCS artifacts referenced by fixture (upload/overwrite). Using dest bucket: %s" % (args.gcs_bucket or "(legacy: fixture buckets)"))
        data = json.loads(fixture_path.read_text())
        # build a plan that maps all uploads to args.gcs_bucket if provided
        plan = build_gcs_plan(data, args.gcs_bucket or None, upload_placeholders=True)
        for item in plan:
            if not item["will_upload"]:
                print(f"Skipping (provenance-only): gs://{item['source_bucket']}/{item['source_path']} -> will not upload")
                continue

            dest_bucket = item["dest_bucket"]
            dest_path = item["dest_path"]
            content_type = item["content_type"] or "application/octet-stream"

            # source content handling: if inline data, use it; otherwise use placeholder
            content = b"placeholder artifact"
            if item["has_source_content"]:
                # find the evidence and extract payload
                ev = next((e for e in data.get("evidence", []) if (e.get("provenance") or "").startswith(item["source_provenance"].split("#", 1)[0])), None)
                if ev:
                    mime, payload = _parse_data_uri(ev.get("image_url") or "")
                    if payload is not None:
                        content = payload
                        content_type = mime or content_type

            # upload to destination bucket only
            bucket_obj = st_client.bucket(dest_bucket)
            blob = bucket_obj.blob(dest_path)
            blob.upload_from_string(content, content_type=content_type)
            print(f"Uploaded gs://{dest_bucket}/{dest_path} (content_type={content_type})")

    print("CLOUD SEED: Done.")


if __name__ == "__main__":
    main()
