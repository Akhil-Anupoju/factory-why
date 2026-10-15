"""Keep unit/API tests hermetic even when the developer shell is GCP-configured.

Some developers run tests from a shell that exports RUNTIME_MODE=PRODUCTION
and ADK_MODEL_PROVIDER=vertex_ai for the local API process. Force the pytest
process onto the in-memory app and local model boundary before test modules
import ``backend.app.main.app``. Live Cloud/Gemini behavior belongs in the
explicitly opt-in integration tests under ``tests/integration``.
"""

import os

os.environ["RUNTIME_MODE"] = "TEST"
os.environ["ADK_MODEL_PROVIDER"] = "local"
os.environ["ADK_MODEL_NAME"] = "none"
