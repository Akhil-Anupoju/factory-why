#!/usr/bin/env python3
"""Seed fresh incident test records to Firestore; dry-run unless --execute."""

from __future__ import annotations

import argparse
import json
from copy import deepcopy

from backend.app.config import Settings
from backend.app.seed.test_incident_fixtures import build_fresh_replay_incident, build_test_incidents


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", default=None, help="GCP project (defaults to GCP_PROJECT/settings)")
    parser.add_argument("--execute", action="store_true", help="Write the generated test incidents to Firestore")
    parser.add_argument("--fresh-replay-only", action="store_true", help="Seed only INC-2026-1001 and preserve all other incidents")
    parser.add_argument("--additional-incidents-only", action="store_true", help="Seed only INC-2026-0902, 0915, 0928, 0938, and 0951")
    parser.add_argument("--incident-ids", nargs="+", help="Seed only these IDs from the generated test incident set")
    parser.add_argument("--fresh-replay-id", default="INC-2026-1001", help="ID for a fresh 0827-shaped incident (use a new ID to preserve a completed run)")
    args = parser.parse_args()

    project = args.project or Settings().gcp_project
    # Never reseed/overwrite INC-2026-0827; it is the resolved reference case.
    if args.additional_incidents_only:
        incidents = build_test_incidents()
    else:
        incidents = [build_fresh_replay_incident(args.fresh_replay_id)]
        if not args.fresh_replay_only:
            incidents.extend(build_test_incidents())
    if args.incident_ids:
        requested_ids = set(args.incident_ids)
        incidents = [incident for incident in incidents if incident["incident_id"] in requested_ids]
        found_ids = {incident["incident_id"] for incident in incidents}
        missing_ids = requested_ids - found_ids
        if missing_ids:
            parser.error(f"Unknown test incident IDs: {', '.join(sorted(missing_ids))}")
    incidents = [
        {
            **{key: value for key, value in incident.items() if key not in ("evidence", "audit_trail")},
            "evidence": deepcopy(incident.get("evidence", [])),
            "audit_trail": deepcopy(incident.get("audit_trail", [])),
        }
        for incident in incidents
    ]
    summary = [
        {
            "incident_id": incident["incident_id"],
            "title": incident.get("title") or incident["incident_id"],
            "asset_id": incident["asset"]["asset_id"],
            "severity": incident["severity"],
            "evidence_count": len(incident["evidence"]),
            "approval": incident["approval"]["decision"],
            "action": incident["action"],
            "outcome": incident["outcome"],
        }
        for incident in incidents
    ]
    print(json.dumps({"project": project, "mode": "WRITE" if args.execute else "DRY_RUN", "incidents": summary}, indent=2))

    if not args.execute:
        print("Dry run only. Re-run with --execute to write these incidents to Firestore.")
        return

    from google.cloud import firestore

    client = firestore.Client(project=project)
    for incident in incidents:
        incident_id = incident["incident_id"]
        incident_doc = {key: value for key, value in incident.items() if key not in ("evidence", "audit_trail")}
        incident_ref = client.collection("incidents").document(incident_id)
        # Clear previous test-run state so every explicit reseed starts fresh.
        for subcollection in ("evidence", "audit"):
            for existing in incident_ref.collection(subcollection).stream():
                existing.reference.delete()
        incident_ref.set(incident_doc)
        for evidence in incident["evidence"]:
            incident_ref.collection("evidence").document(evidence["evidence_id"]).set(evidence)
        for event in incident["audit_trail"]:
            incident_ref.collection("audit").document(event["event_id"]).set(event)
        print(f"Seeded {incident_id} ({len(incident['evidence'])} evidence records)")


if __name__ == "__main__":
    main()
