from __future__ import annotations
from typing import Dict, Any
import json
from pathlib import Path

# Explicit backend-owned fixtures folder. This is the canonical Phase 1
# fixture source. The frontend canonical mock remains at src/data/mockScenarios.ts
# (referenced in docs). Tests and development should fail loudly if this
# backend fixture is missing or malformed to avoid silent fallback behavior.
_FIXTURES_ROOT = Path(__file__).resolve().parents[3] / "backend" / "fixtures"


def load_fixture(name: str) -> Dict[str, Any]:
    p = _FIXTURES_ROOT / name
    if not p.exists():
        raise FileNotFoundError(f"Fixture not found: {p}")
    try:
        return json.loads(p.read_text())
    except Exception as e:
        raise RuntimeError(f"Failed to parse fixture {p}: {e}")


def get_primary_scenario() -> Dict[str, Any]:
    # The frontend canonical source is src/data/mockScenarios.ts. For Phase 1
    # the backend owns an explicit JSON fixture stored at
    # backend/fixtures/cnc04-primary.json. This function will fail loudly if
    # the fixture is missing or malformed to prevent silent minimal fallbacks.
    data = load_fixture("cnc04-primary.json")
    # Expect the top-level object to be the scenario dict
    if not isinstance(data, dict) or data.get("incident_id") is None:
        raise RuntimeError("cnc04-primary.json does not contain a valid scenario object")
    return data
