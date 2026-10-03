import re
from pathlib import Path
import json


def extract_canonical_fields_from_ts(ts_text: str) -> dict:
    """
    Extract a small set of canonical fields from the TypeScript source via
    regex. This is NOT a full TS parser but a deterministic development-time
    parity check comparing a few important keys.
    """
    # incident_id
    m = re.search(r"incident_id:\s*'(?P<incident>[^']+)'", ts_text)
    incident = m.group("incident") if m else None

    # asset.asset_id
    m = re.search(r"asset:\s*{[^}]*asset_id:\s*'(?P<asset>[^']+)'", ts_text, re.S)
    asset = m.group("asset") if m else None

    # recommendation.recommendation_id
    m = re.search(r"recommendation:\s*{[^}]*recommendation_id:\s*'(?P<rec>[^']+)'", ts_text, re.S)
    rec = m.group("rec") if m else None

    return {"incident_id": incident, "asset_id": asset, "recommendation_id": rec}


def test_fixture_parity_ts_vs_backend():
    ts_path = Path("src/data/mockScenarios.ts")
    backend_json_path = Path("backend/fixtures/cnc04-primary.json")
    assert ts_path.exists(), "Frontend baseline src/data/mockScenarios.ts missing"
    assert backend_json_path.exists(), "Backend fixture backend/fixtures/cnc04-primary.json missing"

    ts_text = ts_path.read_text()
    ts_vals = extract_canonical_fields_from_ts(ts_text)

    backend = json.loads(backend_json_path.read_text())

    # Compare the canonical fields and fail loudly if mismatch
    assert backend.get("incident_id") == ts_vals.get("incident_id"), (
        f"Mismatch incident_id: ts={ts_vals.get('incident_id')} backend={backend.get('incident_id')}"
    )
    assert backend.get("asset", {}).get("asset_id") == ts_vals.get("asset_id"), (
        f"Mismatch asset_id: ts={ts_vals.get('asset_id')} backend={backend.get('asset', {}).get('asset_id')}"
    )
    assert backend.get("recommendation", {}).get("recommendation_id") == ts_vals.get("recommendation_id"), (
        f"Mismatch recommendation_id: ts={ts_vals.get('recommendation_id')} backend={backend.get('recommendation', {}).get('recommendation_id')}"
    )
