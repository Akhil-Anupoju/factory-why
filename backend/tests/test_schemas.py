from backend.app.schemas import SimulationParameters, SimulationOptionResult
import pytest


def test_simulation_params_validation():
    with pytest.raises(Exception):
        SimulationParameters(inspection_delay_minutes=0)

    p = SimulationParameters(inspection_delay_minutes=10)
    assert p.inspection_delay_minutes == 10


def test_simulation_option_result_shape():
    r = SimulationOptionResult(
        option="INSPECT",
        title="t",
        description="d",
        risk_indicator="CONTROLLED",
        expected_delay_minutes=25,
        relative_exposure=0.05,
        uncertainty_reduction=0.85,
        estimated_cost_usd=750.0,
        recommended=True,
        tradeoff_summary="s",
        calculation_trace=["a", "b"],
    )
    assert r.option == "INSPECT"


def test_fixture_parsing_with_schema():
    # load fixture via repository and ensure it parses into InvestigationCase
    from backend.app.repositories.fixtures import get_primary_scenario
    from backend.app.schemas import InvestigationCase
    data = get_primary_scenario()
    # Parsing into Pydantic model should not raise
    inv = InvestigationCase.model_validate(data)
    assert inv.incident_id == "INC-2026-0827"
    # round-trip serialization
    dumped = inv.model_dump()
    assert dumped.get("incident_id") == "INC-2026-0827"
