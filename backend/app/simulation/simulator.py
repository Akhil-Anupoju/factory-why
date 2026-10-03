from __future__ import annotations
from typing import Any, List, Dict
from ..schemas import SimulationParameters, SimulationOptionResult


def calculate_deterministic_simulation(params: SimulationParameters) -> List[SimulationOptionResult]:
    # Ported from frontend src/data/mockScenarios.ts calculateDeterministicSimulation
    hourlyRate = params.hourly_production_loss_usd

    # Continue
    continueDelay = 0
    continueCost = round(hourlyRate * 3.5 * params.emergency_repair_multiplier * params.modeled_failure_exposure * 10) / 10 + 18000
    continueTrace = [
        f"Modeled unmitigated failure exposure: {(params.modeled_failure_exposure * 100):.0f}%",
        "Spindle seizure probability window: 14h - 28h continuous operation",
        f"Estimated unmitigated failure loss: ${continueCost:,} (tool wreck + emergency line stop)",
        "Uncertainty reduction: 0% (no diagnostic executed)",
    ]

    # Inspect
    inspectDelay = params.inspection_delay_minutes
    inspectLoss = round((inspectDelay / 60) * hourlyRate)
    inspectToolCost = 250
    inspectTotal = inspectLoss + inspectToolCost
    inspectResidualExposure = round((1 - params.intervention_effectiveness) * params.modeled_failure_exposure * 100) / 100
    inspectTrace = [
        f"Controlled diagnostic pause: {inspectDelay} minutes",
        f"Production idle loss: ${inspectLoss} ({inspectDelay}m @ ${hourlyRate}/hr)",
        f"Tooling & calibration fee: ${inspectToolCost}",
        f"Uncertainty reduction: {(params.intervention_effectiveness * 100):.0f}%",
        f"Residual failure exposure: {(inspectResidualExposure * 100):.1f}%",
    ]

    # Repair
    repairDelay = params.downtime_minutes_if_repair
    repairLoss = round((repairDelay / 60) * hourlyRate)
    repairParts = 2600
    repairTotal = repairLoss + repairParts
    repairTrace = [
        f"Full spindle disassembly & bearing swap: {repairDelay} minutes",
        f"Production loss: ${repairLoss} ({repairDelay}m @ ${hourlyRate}/hr)",
        f"New bearing assembly & consumable kit: ${repairParts}",
        "Premature replacement waste: High (bearing replaced only 4 days ago)",
        "Residual failure exposure: 2.0%",
    ]

    return [
        SimulationOptionResult(
            option="CONTINUE",
            title="Continue Production Run",
            description="Run machine without inspection to finish batch #4881. Defer intervention to scheduled weekend.",
            risk_indicator="HIGH",
            expected_delay_minutes=continueDelay,
            relative_exposure=1.0,
            uncertainty_reduction=0.0,
            estimated_cost_usd=continueCost,
            recommended=False,
            tradeoff_summary="Saves immediate 25m downtime but risks catastrophic spindle seizure ($30k+ total loss).",
            calculation_trace=continueTrace,
        ),
        SimulationOptionResult(
            option="INSPECT",
            title="Targeted Alignment Inspection",
            description="Perform laser runout check on Bearing-B04 and coupling. Loosen housing bolts and shim if required.",
            risk_indicator="CONTROLLED",
            expected_delay_minutes=inspectDelay,
            relative_exposure=inspectResidualExposure,
            uncertainty_reduction=params.intervention_effectiveness,
            estimated_cost_usd=inspectTotal,
            recommended=True,
            tradeoff_summary="Optimal tradeoff: 25 min controlled delay resolves 85% uncertainty with minimal production interruption.",
            calculation_trace=inspectTrace,
        ),
        SimulationOptionResult(
            option="REPAIR",
            title="Full Spindle Bearing Re-Replacement",
            description="Execute full spindle overhaul, replace Bearing-B04, and re-machine sleeve seating collar.",
            risk_indicator="LOW",
            expected_delay_minutes=repairDelay,
            relative_exposure=0.02,
            uncertainty_reduction=0.98,
            estimated_cost_usd=repairTotal,
            recommended=False,
            tradeoff_summary="Guaranteed fix but incurs 180 min excessive downtime and wastes an expensive 4-day-old precision bearing.",
            calculation_trace=repairTrace,
        ),
    ]
