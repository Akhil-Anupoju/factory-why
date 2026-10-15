# Firestore test incidents

The app exposes the incidents in the `incidents` collection through
`GET /api/incidents`. Selecting an incident calls
`GET /api/incidents/{incident_id}` and uses that response for the full
investigation flow (asset, telemetry, evidence, hypotheses, recommendation,
approval, audit, and outcome).

The fresh test set contains:

| Incident | Scenario | Asset | Initial state |
| --- | --- | --- | --- |
| `INC-2026-1001` | Fresh replay of spindle bearing misalignment | CNC-04 | Pending approval |
| `INC-2026-0902` | Lubrication pressure loss | CNC-04 | Pending approval |
| `INC-2026-0915` | Coolant temperature surge | CNC-07 | Pending approval |
| `INC-2026-0928` | Vibration sensor mount drift | CNC-02 | Pending approval |
| `INC-2026-0938` | Hydraulic pressure control drift | CNC-05 | Pending approval |
| `INC-2026-0951` | Spindle drive current imbalance | CNC-09 | Pending approval |
| `INC-2026-0964` | Hydraulic actuator response lag | CNC-06 | Pending approval |
| `INC-2026-0977` | Coolant return flow restriction | CNC-08 | Pending approval |
| `INC-2026-1115` | Tool changer clamp force fault | CNC-03 | Pending approval |
| `INC-2026-1128` | Pneumatic fixture pressure drop | CNC-10 | Pending approval |
| `INC-2026-1141` | Spindle chatter during finish pass | CNC-01 | Pending approval |

`INC-2026-0827` remains the resolved/reference incident and is deliberately not
written by the test seeder. `INC-2026-1001` copies its complete payload shape,
including telemetry series and evidence, while using new evidence and
hypothesis IDs and resetting approval/action/outcome/audit state.
For each repeatable end-to-end run, use a new `--fresh-replay-id` (for example
`INC-2026-1002`) rather than resetting an incident that already has an approval
and action audit trail.

Seed preview (does not write):

```bash
python -m backend.scripts.seed_test_incidents --project YOUR_GCP_PROJECT
```

After confirming the project and planned incident IDs, write the records using
Application Default Credentials:

```bash
gcloud auth application-default login
python -m backend.scripts.seed_test_incidents --project YOUR_GCP_PROJECT --execute
```

To create only the fresh CNC-04 replay case and leave every other incident
document alone:

```bash
python -m backend.scripts.seed_test_incidents --project YOUR_GCP_PROJECT --fresh-replay-only --execute
```

The seed is repeatable: selected fixture incident documents are reset to
pending approval with no action/outcome, and their evidence/audit subcollections
are replaced with fixture data. It leaves `INC-2026-0827` untouched. Use
`--incident-ids` to seed only new test cases when preserving prior demo runs.

If Firestore already contains an incomplete record such as
`INTEGRATION-TEST-INCIDENT`, it is no longer shown in the selector because it
does not satisfy the incident response contract. Select `INC-2026-1001` after
seeding it with the command above.
