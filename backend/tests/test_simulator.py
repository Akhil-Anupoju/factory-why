import pytest
from backend.app.simulation.simulator import calculate_deterministic_simulation
from backend.app.schemas import SimulationParameters, SimulationOptionResult


def test_simulator_full_parity_default():
    params = SimulationParameters()
    results = calculate_deterministic_simulation(params)
    assert isinstance(results, list)
    # Expect exactly three options in known order: CONTINUE, INSPECT, REPAIR
    assert [r.option for r in results] == ["CONTINUE", "INSPECT", "REPAIR"]

    cont = results[0]
    insp = results[1]
    rep = results[2]

    # CONTINUE checks
    assert cont.option == "CONTINUE"
    assert cont.recommended is False
    assert cont.relative_exposure == 1.0
    assert cont.expected_delay_minutes == 0
    assert isinstance(cont.estimated_cost_usd, float) or isinstance(cont.estimated_cost_usd, int)

    # INSPECT checks
    assert insp.option == "INSPECT"
    assert insp.recommended is True
    assert insp.expected_delay_minutes == params.inspection_delay_minutes
    assert insp.uncertainty_reduction == params.intervention_effectiveness
    assert isinstance(insp.calculation_trace, list) and len(insp.calculation_trace) >= 3

    # REPAIR checks
    assert rep.option == "REPAIR"
    assert rep.recommended is False
    assert rep.expected_delay_minutes == params.downtime_minutes_if_repair
    assert rep.relative_exposure == 0.02

def test_simulator_custom_params():
    params = SimulationParameters(inspection_delay_minutes=60, intervention_effectiveness=0.5, modeled_failure_exposure=0.5, hourly_production_loss_usd=2000.0)
    results = calculate_deterministic_simulation(params)
    insp = next(r for r in results if r.option == "INSPECT")
    # expected_loss scales with inspection delay / hourly rate
    assert insp.expected_delay_minutes == 60
    assert insp.uncertainty_reduction == 0.5
