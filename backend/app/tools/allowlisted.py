from __future__ import annotations
from typing import Protocol, List, Dict, Any, TypedDict
from ..services.evidence_service import EvidenceService


# Tool request/response schemas
class GetAssetContextRequest(TypedDict):
    asset_id: str


class GetAssetContextResponse(TypedDict):
    asset_id: str
    name: str
    model: str
    line: str
    facility: str


class GetTelemetryWindowRequest(TypedDict):
    asset_id: str
    start_timestamp: str
    end_timestamp: str


class GetTelemetryWindowResponse(TypedDict):
    points: List[Dict[str, Any]]


class GetMaintenanceHistoryRequest(TypedDict):
    asset_id: str


class GetMaintenanceHistoryResponse(TypedDict):
    work_orders: List[Dict[str, Any]]


class ToolInterface(Protocol):
    def get_asset_context(self, req: GetAssetContextRequest) -> GetAssetContextResponse:
        ...

    def get_telemetry_window(self, req: GetTelemetryWindowRequest) -> GetTelemetryWindowResponse:
        ...

    def get_maintenance_history(self, req: GetMaintenanceHistoryRequest) -> GetMaintenanceHistoryResponse:
        ...

    def search_manual(self, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        ...

    def get_prior_incidents(self, asset_id: str) -> List[Dict[str, Any]]:
        ...

    def get_inspection_image(self, incident_id: str) -> Dict[str, Any]:
        ...
