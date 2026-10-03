from __future__ import annotations
from typing import Dict, Any
from .model_config import ModelConfigLoader


class ADKRunner:
    """Minimal runner that will be used by tests to boot the ADK boundary.

    It does not contact any model provider. It exposes a `run_workflow` API
    accepting a RootOrchestrator and an InvestigationState.
    """

    def __init__(self, services: Dict[str, Any] | None = None):
        self.services = services or {}
        self.model_config = ModelConfigLoader.load_from_env()

    def run_workflow(self, orchestrator, state):
        # For Phase 3A simply call orchestrator.run and return the state.
        return orchestrator.run(state)
