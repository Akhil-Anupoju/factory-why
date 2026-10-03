from backend.app.app_factory import create_app
from backend.app.config import Settings


def test_create_app_local_mode():
    settings = Settings(runtime_mode="LOCAL")
    app = create_app(settings)
    deps = app.state.deps
    assert deps["incident_repo"] is not None
    # Ensure no google cloud clients created in local mode
    assert "google.cloud" not in str(type(deps["incident_repo"]))
