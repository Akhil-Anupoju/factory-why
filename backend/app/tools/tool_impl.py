from __future__ import annotations
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ValidationError

from ..repositories.interfaces import (
    IncidentRepository,
    EvidenceRepository,
    TelemetryRepository,
    StorageRepository,
)
from ..services.evidence_service import EvidenceService
from ..schemas import TelemetryPoint, EvidenceItem


# Request / Response contracts for allowlisted read-only tools
class AssetContextRequest(BaseModel):
    asset_id: str


class AssetContextResponse(BaseModel):
    asset_id: str
    name: str
    model: Optional[str] = None
    line: Optional[str] = None
    facility: Optional[str] = None


class TelemetryWindowRequest(BaseModel):
    asset_id: str
    start_timestamp: Optional[str] = None
    end_timestamp: Optional[str] = None


class TelemetryWindowResponse(BaseModel):
    points: List[TelemetryPoint]


class MaintenanceHistoryRequest(BaseModel):
    asset_id: str


class MaintenanceWorkOrder(BaseModel):
    evidence_id: str
    incident_id: str
    timestamp: str
    observation: str
    provenance: str
    document_snippet: Optional[str] = None
    details: Optional[str] = None
    confidence: Optional[str] = None


class MaintenanceHistoryResponse(BaseModel):
    work_orders: List[MaintenanceWorkOrder]


class SearchManualRequest(BaseModel):
    query: str
    asset_id: Optional[str] = None
    max_results: int = 10


class ManualSearchResult(BaseModel):
    evidence_id: str
    incident_id: str
    asset: str
    component: str
    snippet: str
    provenance: str
    confidence: str


class SearchManualResponse(BaseModel):
    results: List[ManualSearchResult]


class PriorIncidentsRequest(BaseModel):
    asset_id: str
    limit: int = 10


class PriorIncidentSummary(BaseModel):
    incident_id: str
    telemetry_summary: Optional[Dict[str, Any]] = None
    evidence_count: int = 0


class PriorIncidentsResponse(BaseModel):
    incidents: List[PriorIncidentSummary]


class InspectionImageRequest(BaseModel):
    incident_id: str


class InspectionImageResponse(BaseModel):
    evidence_id: str
    timestamp: str
    asset: str
    component: str
    provenance: str
    image_url: Optional[str] = None
    storage_metadata: Optional[Dict[str, Any]] = None


class AllowlistedTools:
    """Thin wrappers around repository/service boundaries for read-only evidence access.

    Tools MUST remain thin: they delegate to repositories or EvidenceService and
    only implement small orchestration logic (filtering, pagination, simple matching).
    """

    def __init__(
        self,
        incident_repo: IncidentRepository,
        evidence_repo: EvidenceRepository,
        telemetry_repo: TelemetryRepository,
        storage_repo: StorageRepository,
        evidence_service: EvidenceService,
    ) -> None:
        self.incident_repo = incident_repo
        self.evidence_repo = evidence_repo
        self.telemetry_repo = telemetry_repo
        self.storage_repo = storage_repo
        self.evidence_service = evidence_service

    def get_asset_context(self, req: Dict[str, Any]) -> AssetContextResponse:
        rq = AssetContextRequest.model_validate(req)
        # Find the first incident that references this asset
        for inc in self.incident_repo.list_incidents():
            asset = inc.get("asset", {})
            if asset.get("asset_id") == rq.asset_id:
                return AssetContextResponse(
                    asset_id=asset.get("asset_id"),
                    name=asset.get("name"),
                    model=asset.get("model"),
                    line=asset.get("line"),
                    facility=asset.get("facility"),
                )
        raise KeyError(f"asset not found: {rq.asset_id}")

    def get_telemetry_window(self, req: Dict[str, Any]) -> TelemetryWindowResponse:
        rq = TelemetryWindowRequest.model_validate(req)
        rows = self.telemetry_repo.query_telemetry(rq.asset_id, start_timestamp=rq.start_timestamp, end_timestamp=rq.end_timestamp)
        # Group rows by timestamp and assemble TelemetryPoint objects with multiple channels
        by_ts: Dict[str, Dict[str, Any]] = {}
        for r in rows:
            ts = r.get("timestamp")
            if not ts:
                continue
            entry = by_ts.setdefault(ts, {"timestamp": ts, "display_time": r.get("display_time")})
            sensor = (r.get("sensor_id") or "").upper()
            val = r.get("value")
            # map sensor id to telemetry channel
            if sensor.startswith("VIB"):
                entry["vibration"] = val
            elif sensor.startswith("TEMP"):
                entry["temperature"] = val
            elif sensor.startswith("CURR") or sensor.startswith("AMP"):
                entry["motor_current"] = val
            elif sensor.startswith("RPM"):
                entry["rpm"] = val
            elif sensor.startswith("PRESS"):
                entry["pressure"] = val
            # copy anomaly flag
            if r.get("is_anomalous"):
                entry["is_anomalous"] = True

        points: List[TelemetryPoint] = []
        for ts, data in sorted(by_ts.items()):
            # ensure missing channels are present as floats or defaults
            try:
                # Fill missing numeric channels with 0.0 to satisfy schema if absent
                normalized = {
                    "timestamp": data.get("timestamp"),
                    "display_time": data.get("display_time") or "",
                    "vibration": float(data.get("vibration", 0.0)),
                    "temperature": float(data.get("temperature", 0.0)),
                    "motor_current": float(data.get("motor_current", 0.0)),
                    "rpm": float(data.get("rpm", 0.0)),
                    "pressure": float(data.get("pressure", 0.0)),
                    "is_anomalous": bool(data.get("is_anomalous", False)),
                }
                points.append(TelemetryPoint.model_validate(normalized))
            except Exception as ex:
                raise RuntimeError(f"Malformed telemetry aggregation for timestamp {ts}: {ex}")

        return TelemetryWindowResponse(points=points)

    def get_maintenance_history(self, req: Dict[str, Any]) -> MaintenanceHistoryResponse:
        rq = MaintenanceHistoryRequest.model_validate(req)
        results: List[MaintenanceWorkOrder] = []
        # Find incidents for asset and collect maintenance work orders using EvidenceService
        for inc in self.incident_repo.list_incidents():
            asset = inc.get("asset", {})
            if asset.get("asset_id") != rq.asset_id:
                continue
            inc_id = inc.get("incident_id")
            # use EvidenceService to ensure we keep only observed, validated evidence
            evs = self.evidence_service.list_evidence(inc_id)
            for ev in evs:
                # maintenance evidence is marked by source or provenance
                if ev.source.lower().find("maint") != -1 or (isinstance(ev.provenance, str) and ev.provenance.startswith("cmms://")):
                    results.append(
                        MaintenanceWorkOrder(
                            evidence_id=ev.evidence_id,
                            incident_id=ev.incident_id,
                            timestamp=ev.timestamp,
                            observation=ev.observation,
                            provenance=ev.provenance,
                            document_snippet=ev.document_snippet,
                            details=ev.details,
                            confidence=ev.confidence,
                        )
                    )
        return MaintenanceHistoryResponse(work_orders=results)

    def search_manual(self, req: Dict[str, Any]) -> SearchManualResponse:
        rq = SearchManualRequest.model_validate(req)
        matches: List[ManualSearchResult] = []
        q = rq.query.strip().lower()
        # scan through incidents and their validated evidence
        for inc in self.incident_repo.list_incidents():
            if rq.asset_id:
                asset = inc.get("asset", {})
                if asset.get("asset_id") != rq.asset_id:
                    continue
            inc_id = inc.get("incident_id")
            evs = self.evidence_service.list_evidence(inc_id)
            for ev in evs:
                # narrow to manual-like evidence
                prov = ev.provenance or ""
                is_manual = ev.source and "manual" in ev.source.lower()
                is_manual = is_manual or (isinstance(prov, str) and "factory-manuals" in prov)
                if not is_manual:
                    continue
                # search in observation, document_snippet, details
                hay = " ".join([str(ev.observation or ""), str(ev.document_snippet or ""), str(ev.details or "")]).lower()
                if q in hay:
                    matches.append(
                        ManualSearchResult(
                            evidence_id=ev.evidence_id,
                            incident_id=ev.incident_id,
                            asset=ev.asset,
                            component=ev.component,
                            snippet=(ev.document_snippet or ev.observation)[:512],
                            provenance=ev.provenance,
                            confidence=ev.confidence,
                        )
                    )
                    if len(matches) >= rq.max_results:
                        break
            if len(matches) >= rq.max_results:
                break
        return SearchManualResponse(results=matches)

    def get_prior_incidents(self, req: Dict[str, Any]) -> PriorIncidentsResponse:
        rq = PriorIncidentsRequest.model_validate(req)
        found: List[PriorIncidentSummary] = []
        for inc in self.incident_repo.list_incidents():
            asset = inc.get("asset", {})
            if asset.get("asset_id") != rq.asset_id:
                continue
            inc_id = inc.get("incident_id")
            # use evidence_service to count validated evidence only
            evs = self.evidence_service.list_evidence(inc_id)
            found.append(
                PriorIncidentSummary(
                    incident_id=inc_id,
                    telemetry_summary=inc.get("telemetry_summary"),
                    evidence_count=len(evs),
                )
            )
            if len(found) >= rq.limit:
                break
        return PriorIncidentsResponse(incidents=found)

    def get_inspection_image(self, req: Dict[str, Any]) -> InspectionImageResponse:
        rq = InspectionImageRequest.model_validate(req)
        # Use EvidenceService to get validated evidence for the incident
        evs = self.evidence_service.list_evidence(rq.incident_id)
        # find the first inspection image evidence
        candidate: Optional[EvidenceItem] = None
        for ev in evs:
            if (ev.source and "inspection" in ev.source.lower()) or ev.image_url:
                candidate = ev
                break
        if not candidate:
            raise KeyError(f"inspection image not found for incident {rq.incident_id}")

        storage_meta = None

        # Prefer explicit storage_location when available. storage_location is expected
        # to be of the form gs://<bucket>/<path> or gcs://<bucket>/<path>. When present,
        # use the path portion to query the configured storage_repo for metadata.
        stor_loc = getattr(candidate, "storage_location", None)
        def _extract_path_from_gcs_uri(uri: str) -> Optional[str]:
            if not isinstance(uri, str):
                return None
            for prefix in ("gs://", "gcs://"):
                if uri.startswith(prefix):
                    rest = uri[len(prefix) :]
                    parts = rest.split("/", 1)
                    if len(parts) == 2:
                        return parts[1]
                    return ""
            return None

        try:
            if stor_loc:
                p = _extract_path_from_gcs_uri(stor_loc)
                if p is not None:
                    storage_meta = self.storage_repo.get_metadata(p)

            # Fallback: if storage_location not present or lookup failed, try provenance
            if storage_meta is None:
                prov = candidate.provenance or ""
                p = _extract_path_from_gcs_uri(prov)
                if p is not None:
                    storage_meta = self.storage_repo.get_metadata(p)
        except Exception:
            storage_meta = None

        return InspectionImageResponse(
            evidence_id=candidate.evidence_id,
            timestamp=candidate.timestamp,
            asset=candidate.asset,
            component=candidate.component,
            provenance=candidate.provenance,
            image_url=candidate.image_url,
            storage_metadata=storage_meta,
        )
