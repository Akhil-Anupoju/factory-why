from __future__ import annotations
from typing import Dict, Any
from dataclasses import dataclass
import os


@dataclass
class ModelConfig:
    provider: str = "local"
    model_name: str = "none"
    max_tokens: int = 1024
    temperature: float = 0.0


class ModelConfigLoader:
    @staticmethod
    def load_from_env() -> ModelConfig:
        provider = os.getenv("ADK_MODEL_PROVIDER", "local")
        model_name = os.getenv("ADK_MODEL_NAME", "none")
        max_tokens = int(os.getenv("ADK_MODEL_MAX_TOKENS", "1024"))
        temperature = float(os.getenv("ADK_MODEL_TEMPERATURE", "0.0"))
        return ModelConfig(provider=provider, model_name=model_name, max_tokens=max_tokens, temperature=temperature)
