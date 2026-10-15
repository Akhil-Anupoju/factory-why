"""Deterministic, fresh-start incident records for local and Firestore testing."""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from typing import Any


PRIMARY_FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "cnc04-primary.json"


def build_fresh_replay_incident(incident_id: str = "INC-2026-1001") -> dict[str, Any]:
    """Clone the known-good CNC-04 fixture into a new, untouched incident."""
    case = json.loads(PRIMARY_FIXTURE.read_text())
    source_id = case["incident_id"]
    evidence_id_map = {
        evidence["evidence_id"]: f"EV-1001-{index:02d}"
        for index, evidence in enumerate(case.get("evidence", []), start=1)
    }
    hypothesis_id_map = {
        hypothesis["hypothesis_id"]: f"HYP-1001-{index:02d}"
        for index, hypothesis in enumerate(case.get("hypotheses", []), start=1)
    }
    suffix = incident_id.removeprefix("INC-2026-")
    recommendation_id = f"REC-{suffix}-01"

    case["incident_id"] = incident_id
    case["title"] = f"CNC-04 Spindle Bearing Misalignment — Fresh Test {suffix}"
    case["description"] = "Fresh, unresolved copy of the CNC-04 spindle anomaly for exercising the complete investigation workflow."
    case["severity"] = "HIGH"
    case["evidence"] = [
        {
            **evidence,
            "evidence_id": evidence_id_map[evidence["evidence_id"]],
            "incident_id": incident_id,
            "provenance": (evidence.get("provenance") or "").replace(source_id, incident_id),
        }
        for evidence in case.get("evidence", [])
    ]
    for hypothesis in case.get("hypotheses", []):
        hypothesis["hypothesis_id"] = hypothesis_id_map[hypothesis["hypothesis_id"]]
        hypothesis["supporting_evidence_ids"] = [evidence_id_map.get(value, value) for value in hypothesis.get("supporting_evidence_ids", [])]
        hypothesis["counter_evidence_ids"] = [evidence_id_map.get(value, value) for value in hypothesis.get("counter_evidence_ids", [])]

    critic = case["critic_finding"]
    critic["critic_id"] = "CRITIC-1001-01"
    critic["target_hypothesis_id"] = hypothesis_id_map.get(critic.get("target_hypothesis_id"), critic.get("target_hypothesis_id"))
    for contradiction in critic.get("contradictions", []):
        contradiction["conflicting_evidence_id"] = evidence_id_map.get(contradiction.get("conflicting_evidence_id"), contradiction.get("conflicting_evidence_id"))
    for ignored in critic.get("ignored_evidence", []):
        ignored["evidence_id"] = evidence_id_map.get(ignored.get("evidence_id"), ignored.get("evidence_id"))

    recommendation = case["recommendation"]
    recommendation["recommendation_id"] = recommendation_id
    recommendation["evidence_references"] = [evidence_id_map.get(value, value) for value in recommendation.get("evidence_references", [])]
    case["approval"] = {
        **case["approval"],
        "approval_id": f"APP-{suffix}-PENDING",
        "incident_id": incident_id,
        "recommendation_id": recommendation_id,
        "decision": "PENDING",
        "engineer_name": "Awaiting engineer",
        "timestamp": "2026-10-14T00:00:00Z",
        "comment": "",
        "signature_hash": "PENDING_ENGINEER_APPROVAL",
    }
    case["action"] = None
    case["outcome"] = None
    # A fresh investigation has no existing actions/audit events.
    case["audit_trail"] = []

    # Fail here during dry-run/tests instead of uploading an invalid incident.
    from backend.app.schemas import InvestigationCase

    return InvestigationCase.model_validate(case).model_dump(mode="json")


def build_test_incidents() -> list[dict[str, Any]]:
    """Return independent, pending incidents that exercise different evidence paths."""
    primary = json.loads(PRIMARY_FIXTURE.read_text())
    specs = [
        {
            "id": "INC-2026-0902",
            "title": "Lubrication Pressure Loss",
            "asset_id": "CNC-04",
            "asset_name": "CNC-04 5-Axis Precision Machining Center",
            "health": 58,
            "component_id": "BEARING-B04",
            "component_name": "Spindle Front Bearing (Bearing-B04)",
            "component_details": "Bearing temperature is rising as lubrication manifold pressure falls below the 4.2 bar baseline.",
            "measurements": {"vibration": (10.20, 8.75, 16.57, "mm/s RMS", "WARNING"), "temperature": (72.30, 61.40, 17.75, "°C", "CRITICAL"), "motor_current": (22.80, 22.50, 1.33, "A", "NORMAL"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (1.80, 4.20, -57.14, "bar", "CRITICAL")},
            "evidence": [
                ("EV-0902-01", "Telemetry stream", "Activity", "Bearing-B04 / LUBE-M01", "Lubrication header pressure fell from 4.2 bar to 1.8 bar while bearing temperature climbed to 72.3°C; motor current and RPM remain near baseline.", "High", "Independent pressure and temperature channels agree with lubrication starvation."),
                ("EV-0902-02", "Maintenance work order", "Wrench", "LUBE-M01", "Filter element was replaced 11 days ago. The service note records elevated differential pressure and defers manifold flushing to the next planned stop.", "High", "A restricted filter is a plausible cause of the pressure loss."),
                ("EV-0902-03", "Service manual", "FileText", "LUBE-M01 / Bearing-B04", "OEM lubrication procedure requires 3.8–4.5 bar supply pressure and a verified oil-air flow before spindle operation.", "High", "The observed 1.8 bar reading is below the documented operating range."),
            ],
            "hypotheses": [
                ("HYP-0902-01", "Lubrication Manifold Restriction", "A clogged filter or sticking solenoid is reducing oil-air delivery to the spindle bearing.", "Likely", 0.88, ["EV-0902-01", "EV-0902-02", "EV-0902-03"], [], "Measure pressure before and after the filter and verify manifold flow."),
                ("HYP-0902-02", "Bearing Damage After Low Lubrication", "The bearing may have sustained surface damage during a period of reduced lubricant delivery.", "Competing", 0.46, ["EV-0902-01"], [], "Inspect lubricant sample and bearing acoustic signature after supply pressure is restored."),
            ],
            "cause": "Restricted lubrication filter or manifold solenoid",
            "check": "Verify oil-air flow and compare pressure upstream and downstream of the filter.",
            "target": "LUBE-M01 / Bearing-B04",
            "action": "Inspect and flush the lubrication manifold; verify flow before restarting the spindle.",
            "procedure": "OSHA-LOTO-HYD-1",
            "urgency": "IMMEDIATE",
        },
        {
            "id": "INC-2026-0915",
            "title": "Coolant Temperature Surge",
            "asset_id": "CNC-07",
            "asset_name": "CNC-07 High-Speed Machining Center",
            "health": 62,
            "component_id": "COOLANT-C07",
            "component_name": "Spindle Coolant Circuit",
            "component_details": "Coolant return temperature and spindle temperature are increasing while flow indication is falling.",
            "measurements": {"vibration": (8.92, 8.75, 1.94, "mm/s RMS", "NORMAL"), "temperature": (81.60, 61.40, 32.90, "°C", "CRITICAL"), "motor_current": (23.10, 22.50, 2.67, "A", "WARNING"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (2.10, 4.20, -50.0, "bar", "CRITICAL")},
            "evidence": [
                ("EV-0915-01", "Telemetry stream", "Activity", "COOLANT-C07 / SPINDLE-T07", "Coolant return temperature reached 81.6°C as circuit pressure fell by 50%; vibration remains within its normal band.", "High", "The thermal/pressure pattern is more consistent with cooling loss than a rotating-component fault."),
                ("EV-0915-02", "Maintenance work order", "Wrench", "COOLANT-C07", "Coolant pump seal inspection is overdue; the last operator note reported intermittent return flow during the prior shift.", "Medium", "The maintenance note is consistent with an intermittent coolant circulation fault."),
                ("EV-0915-03", "Service manual", "FileText", "COOLANT-C07", "The spindle chiller interlock requires minimum circuit pressure of 3.0 bar and return temperature below 65°C.", "High", "Both measured values violate the documented operating envelope."),
            ],
            "hypotheses": [
                ("HYP-0915-01", "Coolant Flow Restriction", "A blocked return path or degraded pump seal is reducing heat removal from the spindle circuit.", "Likely", 0.86, ["EV-0915-01", "EV-0915-02", "EV-0915-03"], [], "Measure flow at the chiller outlet and return; inspect the pump seal and filter."),
                ("HYP-0915-02", "Temperature Sensor Drift", "A biased return-temperature sensor could exaggerate the apparent thermal excursion.", "Competing", 0.31, ["EV-0915-01"], [], "Compare the installed RTD with a calibrated handheld probe."),
            ],
            "cause": "Reduced coolant circulation from a restricted return or degraded pump seal",
            "check": "Verify coolant flow and pressure at the chiller outlet and spindle return before restart.",
            "target": "COOLANT-C07 / SPINDLE-T07",
            "action": "Inspect coolant pump and return filter, then verify stable flow and temperature.",
            "procedure": "OSHA-LOTO-COOLANT-2",
            "urgency": "HIGH",
        },
        {
            "id": "INC-2026-0928",
            "title": "Vibration Sensor Mount Drift",
            "asset_id": "CNC-02",
            "asset_name": "CNC-02 Precision Turning Center",
            "health": 83,
            "component_id": "VIB-B02",
            "component_name": "Spindle Vibration Sensor VIB-B02",
            "component_details": "Primary vibration channel reports a step increase while redundant vibration, temperature, and drive current remain stable.",
            "measurements": {"vibration": (12.10, 8.75, 38.29, "mm/s RMS", "CRITICAL"), "temperature": (61.80, 61.40, 0.65, "°C", "NORMAL"), "motor_current": (22.60, 22.50, 0.44, "A", "NORMAL"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (4.20, 4.20, 0.0, "bar", "NORMAL")},
            "evidence": [
                ("EV-0928-01", "Telemetry stream", "Activity", "VIB-B02 / CNC-02", "Primary vibration sensor rose to 12.1 mm/s, but redundant casing sensor stayed at 8.8 mm/s and temperature/current stayed at baseline.", "High", "The independent channels do not show the correlated response expected from a mechanical failure."),
                ("EV-0928-02", "Maintenance work order", "Wrench", "VIB-B02", "Sensor bracket was removed and reinstalled during guarding work yesterday; torque verification is not recorded.", "Medium", "Recent handling makes a loose sensor mount plausible."),
                ("EV-0928-03", "Service manual", "FileText", "VIB-B02", "Accelerometer mounting surface must be clean and fastened to 8 Nm; a loose stud can amplify high-frequency vibration.", "High", "The maintenance verification gap directly maps to a testable sensor-mount failure."),
            ],
            "hypotheses": [
                ("HYP-0928-01", "Loose Accelerometer Mount", "A loose bracket or mounting stud is amplifying the primary vibration reading without a corresponding machine-wide change.", "Likely", 0.79, ["EV-0928-01", "EV-0928-02", "EV-0928-03"], [], "Inspect mounting torque and compare the channel with a calibrated portable sensor."),
                ("HYP-0928-02", "Localized Spindle Bearing Wear", "Early bearing wear could produce vibration before a large temperature change is visible.", "Competing", 0.35, ["EV-0928-01"], [], "Collect a vibration spectrum and compare bearing-frequency peaks with the redundant sensor."),
            ],
            "cause": "Unverified accelerometer bracket torque causing an isolated vibration reading",
            "check": "Inspect sensor seating and torque, then validate against a calibrated portable accelerometer.",
            "target": "VIB-B02 / Spindle housing",
            "action": "Check sensor mounting and channel calibration before authorizing mechanical repair.",
            "procedure": "ELECTRICAL-SENSOR-CAL-3",
            "urgency": "MEDIUM",
        },
        {
            "id": "INC-2026-0938",
            "title": "Hydraulic Pressure Control Drift",
            "asset_id": "CNC-05",
            "asset_name": "CNC-05 Horizontal Machining Center",
            "health": 71,
            "component_id": "HYD-VLV-05",
            "component_name": "Hydraulic Pressure Regulator Valve",
            "component_details": "Hydraulic pressure oscillates above its operating band while spindle vibration remains near baseline.",
            "measurements": {"vibration": (8.96, 8.75, 2.40, "mm/s RMS", "NORMAL"), "temperature": (63.10, 61.40, 2.77, "°C", "NORMAL"), "motor_current": (23.20, 22.50, 3.11, "A", "WARNING"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (6.10, 4.20, 45.24, "bar", "CRITICAL")},
            "evidence": [
                ("EV-0938-01", "Telemetry stream", "Activity", "HYD-VLV-05 / HYD-P05", "Hydraulic pressure oscillated between 5.8 and 6.3 bar against a 4.2 bar baseline; spindle vibration and temperature stayed near normal.", "High", "Pressure-only behavior points toward regulation/control rather than spindle damage."),
                ("EV-0938-02", "Maintenance work order", "Wrench", "HYD-VLV-05", "The proportional regulator was recalibrated last month. The maintenance record notes the valve response was slow near the upper setpoint.", "Medium", "The documented sluggish valve response aligns with the current pressure overshoot."),
                ("EV-0938-03", "Service manual", "FileText", "HYD-VLV-05", "Hydraulic supply must remain between 3.8 and 4.6 bar; pressure above 5.0 bar requires regulator inspection before production.", "High", "Current pressure exceeds the regulator inspection threshold."),
            ],
            "hypotheses": [
                ("HYP-0938-01", "Regulator Valve Stiction", "A sticking proportional valve is overshooting the commanded pressure setpoint.", "Likely", 0.84, ["EV-0938-01", "EV-0938-02", "EV-0938-03"], [], "Compare commanded pressure with a calibrated gauge while stepping the regulator through its setpoint."),
                ("HYP-0938-02", "Pressure Sensor Offset", "A biased pressure transducer could be reporting a falsely high supply pressure.", "Competing", 0.37, ["EV-0938-01"], [], "Verify the installed transducer against a calibrated mechanical gauge."),
            ],
            "cause": "Proportional hydraulic regulator valve stiction",
            "check": "Trend commanded versus measured pressure using a calibrated gauge while exercising the valve.",
            "target": "HYD-VLV-05 / HYD-P05",
            "action": "Inspect regulator response and verify pressure setpoint with a calibrated gauge before production.",
            "procedure": "OSHA-LOTO-HYD-5",
            "urgency": "HIGH",
        },
        {
            "id": "INC-2026-0951",
            "title": "Spindle Drive Current Imbalance",
            "asset_id": "CNC-09",
            "asset_name": "CNC-09 Vertical Machining Center",
            "health": 67,
            "component_id": "DRIVE-M09",
            "component_name": "Spindle Drive Motor and Power Feed",
            "component_details": "Drive current is elevated and phase-imbalanced with a smaller correlated vibration and thermal rise.",
            "measurements": {"vibration": (10.10, 8.75, 15.43, "mm/s RMS", "WARNING"), "temperature": (70.20, 61.40, 14.33, "°C", "CRITICAL"), "motor_current": (31.50, 22.50, 40.0, "A", "CRITICAL"), "rpm": (3390, 3400, -0.29, "RPM", "NORMAL"), "pressure": (4.20, 4.20, 0.0, "bar", "NORMAL")},
            "evidence": [
                ("EV-0951-01", "Telemetry stream", "Activity", "DRIVE-M09 / MOTOR-M09", "Spindle drive current increased to 31.5 A with a 6.8 A phase spread; motor temperature and vibration rose while hydraulic pressure remained stable.", "High", "Electrical imbalance with correlated heating suggests a drive or power-feed issue."),
                ("EV-0951-02", "Maintenance work order", "Wrench", "DRIVE-M09", "The drive cabinet cooling fan was replaced two weeks ago. No post-repair phase-current balance check is recorded.", "Medium", "Recent cabinet service makes drive connections and cooling a relevant inspection path."),
                ("EV-0951-03", "Service manual", "FileText", "DRIVE-M09 / MOTOR-M09", "The spindle drive permits no more than 10% phase-current imbalance; sustained overcurrent requires a qualified electrical inspection before continued operation.", "High", "Observed current and phase spread exceed the documented threshold."),
            ],
            "hypotheses": [
                ("HYP-0951-01", "Drive Output Phase Imbalance", "A loose terminal or drive output-stage fault is producing phase imbalance and excess motor heating.", "Likely", 0.81, ["EV-0951-01", "EV-0951-02", "EV-0951-03"], [], "Under LOTO, inspect drive terminals and compare all three phase currents with a calibrated clamp meter."),
                ("HYP-0951-02", "Mechanical Spindle Drag", "A developing mechanical load could increase current and temperature before a larger speed drop occurs.", "Competing", 0.42, ["EV-0951-01"], [], "Compare unloaded spindle current with phase balance and inspect spindle rotation resistance."),
            ],
            "cause": "Spindle drive output phase imbalance or a loose power connection",
            "check": "Inspect drive output connections under LOTO and measure phase currents with a calibrated clamp meter.",
            "target": "DRIVE-M09 / MOTOR-M09",
            "action": "Perform a qualified drive cabinet and phase-current balance inspection before returning the spindle to service.",
            "procedure": "NFPA-70E-LOTO-DRIVE-9",
            "urgency": "IMMEDIATE",
        },
        {
            "id": "INC-2026-0964",
            "title": "Hydraulic Actuator Response Lag",
            "asset_id": "CNC-06",
            "asset_name": "CNC-06 Heavy-Duty Horizontal Mill",
            "health": 74,
            "component_id": "HYD-ACT-06",
            "component_name": "Pallet Clamp Hydraulic Actuator",
            "component_details": "Pallet clamp confirmation is delayed while static hydraulic supply pressure remains near nominal.",
            "measurements": {"vibration": (8.94, 8.75, 2.17, "mm/s RMS", "NORMAL"), "temperature": (64.20, 61.40, 4.56, "°C", "WARNING"), "motor_current": (24.10, 22.50, 7.11, "A", "WARNING"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (4.05, 4.20, -3.57, "bar", "NORMAL")},
            "evidence": [
                ("EV-0964-01", "Telemetry stream", "Activity", "HYD-ACT-06 / HYD-P06", "Clamp confirmation time rose from 1.2 s to 4.8 s. Static pressure is 4.05 bar, but pressure recovery after each clamp cycle is slower than normal.", "High", "Cycle response degradation is present even though static pressure is near its nominal value."),
                ("EV-0964-02", "Maintenance work order", "Wrench", "HYD-ACT-06", "Cylinder rod seal inspection is overdue by 420 operating hours. Operators noted occasional clamp hesitation on the previous shift.", "Medium", "The service interval and operator note are consistent with internal leakage or mechanical drag."),
                ("EV-0964-03", "Service manual", "FileText", "HYD-ACT-06", "Pallet clamp must reach confirmation pressure within 2.0 s. Slow response requires checking cylinder leakage, directional valve travel, and return-line restriction.", "High", "Measured 4.8 s response exceeds the OEM limit."),
            ],
            "hypotheses": [
                ("HYP-0964-01", "Internal Clamp-Cylinder Leakage", "A worn rod seal may be allowing internal bypass flow, slowing clamp travel while static supply pressure remains normal.", "Likely", 0.78, ["EV-0964-01", "EV-0964-02", "EV-0964-03"], [], "Run the cylinder leakage hold test and compare pressure decay on both actuator ports."),
                ("HYP-0964-02", "Directional Valve Spool Stiction", "A sticky directional valve may be delaying flow to the clamp cylinder without causing a static pressure alarm.", "Competing", 0.49, ["EV-0964-01", "EV-0964-03"], [], "Measure valve command-to-spool response and compare clamp extension and retraction times."),
            ],
            "cause": "Hydraulic clamp actuator response degradation, with internal leakage as the leading hypothesis",
            "check": "Run a pressure-hold leakage test and measure directional-valve response before replacing components.",
            "target": "HYD-ACT-06 / Directional valve DV-06",
            "action": "Inspect clamp-cylinder leakage and valve response; verify clamp confirmation returns below 2.0 seconds.",
            "procedure": "OSHA-LOTO-HYD-6",
            "urgency": "HIGH",
        },
        {
            "id": "INC-2026-0977",
            "title": "Coolant Return Flow Restriction",
            "asset_id": "CNC-08",
            "asset_name": "CNC-08 High-Speed Five-Axis Center",
            "health": 69,
            "component_id": "COOL-RET-08",
            "component_name": "Spindle Coolant Return Circuit",
            "component_details": "Coolant return flow has fallen while spindle temperature and vibration rise during sustained cutting.",
            "measurements": {"vibration": (10.35, 8.75, 18.29, "mm/s RMS", "WARNING"), "temperature": (76.40, 61.40, 24.43, "°C", "CRITICAL"), "motor_current": (24.20, 22.50, 7.56, "A", "WARNING"), "rpm": (3385, 3400, -0.44, "RPM", "NORMAL"), "pressure": (2.75, 4.20, -34.52, "bar", "CRITICAL")},
            "evidence": [
                ("EV-0977-01", "Telemetry stream", "Activity", "COOL-RET-08 / TEMP-S08", "Coolant return flow dropped 34% and spindle temperature reached 76.4°C. Vibration increased during loaded cuts but falls when the spindle is unloaded.", "High", "The load-dependent thermal and vibration pattern is consistent with restricted cooling under production load."),
                ("EV-0977-02", "Maintenance work order", "Wrench", "COOL-RET-08", "The return-line strainer was cleaned 6 weeks ago. The work order noted metal fines in the mesh and recommended a follow-up inspection that was not recorded.", "Medium", "A partially reblocked strainer is plausible and has a direct maintenance trail."),
                ("EV-0977-03", "Service manual", "FileText", "COOL-RET-08 / SPINDLE-S08", "The spindle cooling loop requires at least 3.5 bar return pressure and a return temperature below 65°C under rated load.", "High", "The measured return pressure and temperature exceed the maintenance thresholds."),
            ],
            "hypotheses": [
                ("HYP-0977-01", "Coolant Return Strainer Restriction", "Accumulated fines in the return strainer are restricting flow under load and reducing heat removal.", "Likely", 0.83, ["EV-0977-01", "EV-0977-02", "EV-0977-03"], [], "Inspect the strainer differential pressure and measure return flow at rated spindle load."),
                ("HYP-0977-02", "Coolant Pump Wear", "A worn pump may be unable to maintain required flow when spindle cooling demand increases.", "Competing", 0.44, ["EV-0977-01", "EV-0977-03"], [], "Compare pump outlet pressure with return pressure and verify flow at both idle and rated load."),
            ],
            "cause": "Restricted coolant return flow, with strainer fouling as the leading hypothesis",
            "check": "Measure strainer differential pressure and coolant return flow at rated spindle load.",
            "target": "COOL-RET-08 / spindle cooling loop",
            "action": "Inspect and clean the return strainer, then verify rated-load flow and temperature before resuming production.",
            "procedure": "OSHA-LOTO-COOL-8",
            "urgency": "HIGH",
        },
        {
            "id": "INC-2026-1115",
            "title": "Tool Changer Clamp Force Fault",
            "asset_id": "CNC-03",
            "asset_name": "CNC-03 Vertical Machining Center with ATC",
            "health": 61,
            "component_id": "ATC-ARM-03",
            "component_name": "Automatic Tool Changer Clamp Mechanism",
            "component_details": "Tool clamp confirmation pressure is intermittently low during tool-change cycles while the spindle is otherwise stable between changes.",
            "measurements": {"vibration": (9.05, 8.75, 3.43, "mm/s RMS", "NORMAL"), "temperature": (62.10, 61.40, 1.14, "°C", "NORMAL"), "motor_current": (22.70, 22.50, 0.89, "A", "NORMAL"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (3.40, 4.20, -19.05, "bar", "WARNING")},
            "evidence": [
                ("EV-1115-01", "Telemetry stream", "Activity", "ATC-ARM-03 / CLAMP-S03", "Tool clamp confirmation pressure read 3.4 bar on the last 4 of 20 tool changes, intermittently below the 3.8 bar clamp-confirm threshold; spindle vibration and current stay nominal between changes.", "Medium", "An intermittent, cycle-specific pressure dip points toward the tool-change mechanism rather than the spindle drivetrain."),
                ("EV-1115-02", "Maintenance work order", "Wrench", "ATC-ARM-03", "The tool changer's pull-stud retention spring was flagged as 'near end of service life' during the last quarterly PM, with replacement deferred to the next scheduled outage.", "High", "A weakening retention spring directly explains an intermittent, not constant, clamp-force shortfall."),
                ("EV-1115-03", "Service manual", "FileText", "ATC-ARM-03", "Tool clamp-confirm pressure must be at least 3.8 bar on every cycle; readings below this threshold on more than 1 in 10 changes require retention-spring inspection before unattended operation.", "High", "The observed failure rate (4 of 20 changes) exceeds the documented inspection threshold."),
            ],
            "hypotheses": [
                ("HYP-1115-01", "Weakening Pull-Stud Retention Spring", "A retention spring nearing end-of-life is intermittently under-clamping the tool holder during the changer cycle.", "Likely", 0.80, ["EV-1115-01", "EV-1115-02", "EV-1115-03"], [], "Measure clamp-confirm pressure across 20 consecutive cycles and compare against the retention-spring service record."),
                ("HYP-1115-02", "Clamp Sensor Intermittent Fault", "A marginal pressure switch or wiring connection could intermittently under-report clamp pressure without a true mechanical shortfall.", "Competing", 0.40, ["EV-1115-01"], [], "Substitute a calibrated pressure gauge in place of the installed switch and repeat the cycle test."),
            ],
            "cause": "Intermittent tool clamp under-force, with a degraded pull-stud retention spring as the leading hypothesis",
            "check": "Cycle the tool changer 20 times while logging clamp-confirm pressure and compare against the retention-spring service interval.",
            "target": "ATC-ARM-03 / Pull-stud retention spring",
            "action": "Inspect and, if indicated, replace the pull-stud retention spring before resuming unattended production.",
            "procedure": "OSHA-LOTO-ATC-3",
            "urgency": "HIGH",
        },
        {
            "id": "INC-2026-1128",
            "title": "Pneumatic Fixture Pressure Drop",
            "asset_id": "CNC-10",
            "asset_name": "CNC-10 Production Milling Cell",
            "health": 76,
            "component_id": "PNEU-FIX-10",
            "component_name": "Pneumatic Workholding Fixture Circuit",
            "component_details": "Fixture clamp air pressure is trending down across a shift while spindle-side telemetry remains nominal.",
            "measurements": {"vibration": (8.80, 8.75, 0.57, "mm/s RMS", "NORMAL"), "temperature": (61.70, 61.40, 0.49, "°C", "NORMAL"), "motor_current": (22.55, 22.50, 0.22, "A", "NORMAL"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (4.70, 6.00, -21.67, "bar", "WARNING")},
            "evidence": [
                ("EV-1128-01", "Telemetry stream", "Activity", "PNEU-FIX-10 / AIR-SUPPLY-10", "Fixture clamp-circuit pressure declined from 6.0 bar to 4.7 bar over the shift with no corresponding change in spindle vibration, temperature, or current.", "High", "A pressure-only trend isolated to the fixture circuit points away from a spindle or drivetrain cause."),
                ("EV-1128-02", "Maintenance work order", "Wrench", "PNEU-FIX-10", "A shared plant air header serves three cells; a compressor demand study flagged intermittent header pressure sag during peak shift overlap, with no fixture-specific leak reported.", "Medium", "A shared-header capacity issue is a plausible, non-component-specific explanation for the slow pressure decline."),
                ("EV-1128-03", "Service manual", "FileText", "PNEU-FIX-10", "The workholding fixture requires a minimum of 5.5 bar supply pressure to guarantee rated clamp force; sustained operation below this threshold risks part shift during machining.", "High", "The measured 4.7 bar is below the documented minimum clamp-force threshold."),
            ],
            "hypotheses": [
                ("HYP-1128-01", "Shared Air Header Capacity Shortfall", "Peak simultaneous demand across cells on a shared header is dropping local supply pressure below the fixture's rated minimum.", "Likely", 0.74, ["EV-1128-01", "EV-1128-02", "EV-1128-03"], [], "Log header pressure at the fixture regulator during peak and off-peak shift overlap and compare with compressor output."),
                ("HYP-1128-02", "Localized Fixture Circuit Leak", "A developing leak in the fixture's quick-connects or cylinder seals could independently explain the pressure decline.", "Competing", 0.41, ["EV-1128-01"], [], "Isolate the fixture circuit with a shutoff valve and perform a bubble-test leak check under static pressure."),
            ],
            "cause": "Workholding clamp pressure below rated minimum, with shared air-header capacity as the leading hypothesis",
            "check": "Log fixture regulator pressure through a full shift cycle and correlate with plant compressor demand.",
            "target": "PNEU-FIX-10 / Shared plant air header",
            "action": "Verify fixture clamp pressure stays above 5.5 bar through peak demand before resuming unattended cycles.",
            "procedure": "OSHA-LOTO-PNEU-10",
            "urgency": "MEDIUM",
        },
        {
            "id": "INC-2026-1141",
            "title": "Spindle Chatter During Finish Pass",
            "asset_id": "CNC-01",
            "asset_name": "CNC-01 Five-Axis Finishing Center",
            "health": 72,
            "component_id": "SPINDLE-01",
            "component_name": "Spindle and Finishing Tool Assembly",
            "component_details": "High-frequency vibration appears only during the finish pass at full feed rate and correlates with an aging finishing tool.",
            "measurements": {"vibration": (14.80, 8.75, 69.14, "mm/s RMS", "CRITICAL"), "temperature": (63.50, 61.40, 3.42, "°C", "NORMAL"), "motor_current": (23.40, 22.50, 4.00, "A", "WARNING"), "rpm": (3400, 3400, 0.0, "RPM", "NORMAL"), "pressure": (4.20, 4.20, 0.0, "bar", "NORMAL")},
            "evidence": [
                ("EV-1141-01", "Telemetry stream", "Activity", "SPINDLE-01 / TOOL-F01", "Vibration spikes to 14.8 mm/s only during the finish pass at full feed rate and drops back to baseline during roughing passes and tool-idle periods; motor current rises modestly in step.", "High", "The cut-condition-specific, feed-correlated vibration pattern is consistent with cutting-process chatter rather than a continuous spindle-bearing fault."),
                ("EV-1141-02", "Maintenance work order", "Wrench", "TOOL-F01", "The current finishing end mill has logged 340 cutting hours against a 250-hour recommended tool-life interval; the work order has no record of a mid-life edge inspection.", "High", "An overdue, worn cutting edge is a documented and testable chatter contributor."),
                ("EV-1141-03", "Service manual", "FileText", "SPINDLE-01 / TOOL-F01", "Finishing chatter above 12 mm/s RMS during full-feed passes should first be evaluated against tool wear and feed/speed parameters before spindle-bearing inspection is scheduled.", "High", "The manual directs tool-wear evaluation as the first diagnostic step for this exact vibration signature."),
            ],
            "hypotheses": [
                ("HYP-1141-01", "Worn Finishing Tool Edge", "A cutting edge well past its recommended tool-life interval is inducing regenerative chatter specifically during the full-feed finish pass.", "Likely", 0.82, ["EV-1141-01", "EV-1141-02", "EV-1141-03"], [], "Inspect the tool edge under magnification and compare surface finish and vibration with a fresh tool at identical parameters."),
                ("HYP-1141-02", "Finish-Pass Feed/Speed Mismatch", "The programmed feed and speed for the finish pass may be poorly matched to the current setup, inducing chatter independent of tool wear.", "Competing", 0.39, ["EV-1141-01"], [], "Re-run the finish pass at a reduced feed override and compare the vibration signature."),
            ],
            "cause": "Finish-pass chatter, with an overdue finishing tool as the leading hypothesis",
            "check": "Swap in a fresh finishing tool at identical program parameters and compare the vibration signature against the worn tool.",
            "target": "SPINDLE-01 / TOOL-F01",
            "action": "Inspect and replace the finishing tool if worn beyond spec, then re-verify the finish pass before resuming production.",
            "procedure": "ELECTRICAL-SENSOR-CAL-1",
            "urgency": "MEDIUM",
        },
    ]

    incidents = []
    for spec in specs:
        case = deepcopy(primary)
        incident_id = spec["id"]
        case["incident_id"] = incident_id
        case["title"] = spec["title"]
        case["severity"] = "HIGH" if spec["urgency"] in ("IMMEDIATE", "HIGH") else "MEDIUM"
        case["description"] = f"Fresh test incident: {spec['title']}. No approval, action, or outcome has been recorded."
        asset = case["asset"]
        asset.update(asset_id=spec["asset_id"], name=spec["asset_name"], health_score=spec["health"], status="ABNORMAL")
        asset["components"] = [
            {"component_id": spec["component_id"], "name": spec["component_name"], "type": "SENSOR_ARRAY" if "VIB-" in spec["component_id"] or "COOLANT" in spec["component_id"] else "SHAFT" if ("ATC-" in spec["component_id"] or "PNEU-" in spec["component_id"] or "SPINDLE-" in spec["component_id"]) else "BEARING", "status": "ABNORMAL", "last_serviced": "2026-09-20", "details": spec["component_details"], "sensor_ids": [spec["component_id"]]},
            {"component_id": "SENSORS-SYS", "name": "Diagnostic Sensor Array", "type": "SENSOR_ARRAY", "status": "NOMINAL", "last_serviced": "2026-09-20", "details": "Independent channels available for cross-checking.", "sensor_ids": list(spec["measurements"])},
        ]
        case["telemetry_summary"] = {
            key: {"current": values[0], "baseline": values[1], "delta_pct": values[2], "unit": values[3], "status": values[4]}
            for key, values in spec["measurements"].items()
        }
        telemetry_channels = ("vibration", "temperature", "motor_current", "rpm", "pressure")
        baseline_points = []
        for index, point in enumerate(case["telemetry_series"][:7]):
            # Preserve small, realistic pre-alert fluctuations around the
            # baseline instead of plotting a perfectly flat synthetic line.
            offsets = (0.0, -0.004, 0.003, -0.002, 0.002, -0.003, 0.0)
            baseline_points.append({
                "timestamp": f"2026-10-01T{8 + index:02d}:00:00Z",
                "display_time": f"{8 + index:02d}:00",
                **{
                    channel: round(
                        spec["measurements"][channel][1]
                        + offsets[index] * max(abs(spec["measurements"][channel][1]), 1),
                        3,
                    )
                    for channel in telemetry_channels
                },
            })

        # Show the anomaly developing over several samples after onset. The
        # old fixture had only one abnormal point at the end, which made the
        # chart look flat until a final jump and hid the degradation story.
        telemetry_series = baseline_points
        progression = [
            ("14:18", 0.24),
            ("14:30", 0.42),
            ("15:00", 0.62),
            ("15:30", 0.82),
            ("16:00", 1.0),
        ]
        for display_time, fraction in progression:
            hour, minute = (int(part) for part in display_time.split(":"))
            telemetry_series.append({
                "timestamp": f"2026-10-01T{hour:02d}:{minute:02d}:00Z",
                "display_time": display_time,
                **{
                    channel: round(
                        spec["measurements"][channel][1]
                        + (spec["measurements"][channel][0] - spec["measurements"][channel][1]) * fraction,
                        3,
                    )
                    for channel in telemetry_channels
                },
                "is_anomalous": True,
            })
        case["telemetry_series"] = telemetry_series
        case["evidence"] = [
            {"evidence_id": evidence_id, "incident_id": incident_id, "source": source, "source_icon": icon, "timestamp": f"2026-10-01T14:{30 + index:02d}:00Z", "asset": spec["asset_id"], "component": component, "observation": observation, "provenance": f"test-fixture://{incident_id}/{evidence_id}", "status": "Observed", "confidence": confidence, "details": details}
            for index, (evidence_id, source, icon, component, observation, confidence, details) in enumerate(spec["evidence"])
        ]
        case["hypotheses"] = [
            {"hypothesis_id": hypothesis_id, "title": title, "description": description, "status": status, "confidence": confidence, "inferred_mechanism": description, "supporting_evidence_ids": support, "counter_evidence_ids": counter, "missing_evidence": [next_check], "next_discriminating_check": next_check, "likelihood_rank": index + 1}
            for index, (hypothesis_id, title, description, status, confidence, support, counter, next_check) in enumerate(spec["hypotheses"])
        ]
        lead = case["hypotheses"][0]
        first_evidence = case["evidence"][0]
        case["critic_finding"] = {"critic_id": f"CRITIC-{incident_id[-4:]}", "target_hypothesis_id": lead["hypothesis_id"], "run_timestamp": "2026-10-01T14:36:00Z", "contradictions": [], "ignored_evidence": [], "falsification_condition": f"The leading hypothesis is falsified if the following test is normal: {spec['check']}", "strongest_discriminating_check": spec["check"], "recommendation_action": "PROCEED_TO_SIMULATION", "confidence_delta": 0.0}
        case["recommendation"] = {"recommendation_id": f"REC-{incident_id[-4:]}-01", "next_step": spec["action"], "target_component": spec["target"], "action_type": "NON_DESTRUCTIVE_DIAGNOSTIC_INSPECTION", "urgency": spec["urgency"], "time_window": "Before returning the asset to production", "rationale": f"The next discriminating check is grounded in {first_evidence['evidence_id']} and will distinguish the competing hypotheses before invasive work is authorized.", "uncertainty_pct": round((1 - lead["confidence"]) * 100, 1), "evidence_references": [evidence["evidence_id"] for evidence in case["evidence"]], "estimated_duration_minutes": 25, "safety_protocol_code": spec["procedure"]}
        case["approval"] = {"approval_id": f"APP-{incident_id[-4:]}-PENDING", "incident_id": incident_id, "recommendation_id": case["recommendation"]["recommendation_id"], "decision": "PENDING", "engineer_name": "Awaiting engineer", "engineer_role": "Reliability Engineer", "timestamp": "2026-10-01T14:37:00Z", "comment": "", "authorized_action": case["recommendation"]["next_step"], "signature_hash": "PENDING_ENGINEER_APPROVAL"}
        case["action"] = None
        case["outcome"] = None
        case["audit_trail"] = []
        incidents.append(case)
    return incidents
