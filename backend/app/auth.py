from __future__ import annotations
from typing import Any, Dict, Optional
import os
import logging
import time

_LOG = logging.getLogger(__name__)

from pydantic import BaseModel
import os.path


class TokenVerificationError(Exception):
    pass


class InvalidTokenError(TokenVerificationError):
    pass


class ExpiredTokenError(TokenVerificationError):
    pass


class AuthenticatedUser(BaseModel):
    uid: str
    email: Optional[str]
    display_name: Optional[str]
    email_verified: Optional[bool] = False
    claims: Dict[str, Any] = {}


class FirebaseVerifier:
    """Default verifier that lazily imports firebase_admin when needed.

    This implementation defers importing firebase_admin until verify_id_token
    is called so tests can mock the AuthService without requiring the SDK.
    """

    def __init__(self, project_id: Optional[str] = None):
        # Default to env FIREBASE_PROJECT, fallback to known default project
        # to help local runs when the operator hasn't set the env var.
        self.project_id = project_id or os.environ.get("FIREBASE_PROJECT", "factory-why-hackathon")
        self._firebase_auth = None
        self._firebase_app = None
        self._initialized = False

    def get_diagnostics(self) -> Dict[str, Any]:
        """Return safe diagnostics about firebase initialization and ADC.

        This intentionally avoids logging or returning any sensitive
        credential contents. Values returned are booleans or short
        strings suitable for safe diagnostics.
        """
        diag: Dict[str, Any] = {"project_id": self.project_id, "initialized": bool(self._initialized)}

        # Inspect environment-based credential path
        gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        diag["gac_path_set"] = bool(gac)
        diag["gac_exists"] = False
        if gac:
            try:
                diag["gac_exists"] = os.path.exists(gac)
            except Exception:
                diag["gac_exists"] = False

        # Probe Application Default Credentials availability.
        try:
            import google.auth  # type: ignore

            creds, project = google.auth.default()
            diag["adc_ok"] = creds is not None
            # project may be empty or None; do not expose full project here
            diag["adc_project_detected"] = bool(project)
        except Exception as e:
            diag["adc_ok"] = False
            diag["adc_error"] = f"{e.__class__.__name__}: {str(e)}"

        return diag

    def _ensure_auth(self):
        if self._firebase_auth is not None:
            return
        try:
            import firebase_admin  # type: ignore
            from firebase_admin import auth as firebase_auth  # type: ignore
        except Exception as ex:
            raise RuntimeError("firebase_admin is required for token verification") from ex

        # Initialize default app lazily if not already initialized
        try:
            # If an app is not initialized, initialize with projectId when
            # known. ADC (Application Default Credentials) will be used by
            # the SDK when available.
            if not firebase_admin._apps:
                options = {}
                if self.project_id:
                    options["projectId"] = self.project_id
                if options:
                    firebase_admin.initialize_app(options=options)
                else:
                    firebase_admin.initialize_app()
                self._firebase_app = firebase_admin.get_app()
                self._initialized = True
            else:
                # An app already exists; capture a reference and note init
                try:
                    self._firebase_app = firebase_admin.get_app()
                    self._initialized = True
                except Exception:
                    # fallback: leave initialized False but still allow auth calls
                    self._firebase_app = None
                    self._initialized = False
        except Exception as init_exc:
            # Surface initialization errors as runtime error so callers
            # (and startup checks) can fail fast. Keep message safe.
            _LOG.exception("Failed to initialize firebase_admin")
            raise RuntimeError("Failed to initialize firebase_admin: %s" % str(init_exc)) from init_exc

        self._firebase_auth = firebase_auth

    def verify_id_token(self, id_token: str) -> Dict[str, Any]:
        self._ensure_auth()
        # Record that verification was attempted (no token data logged).
        _LOG.debug("FirebaseVerifier: verify_id_token called; project=%s, initialized=%s", self.project_id, self._initialized)

        # Firebase's Python Admin SDK applies zero clock-skew tolerance for
        # "token used before issued" checks. A local machine clock that is
        # even 1-2 seconds behind Google's authoritative time will cause a
        # freshly-minted, otherwise perfectly valid token to be rejected
        # with "Token used too early". This self-resolves within a couple
        # of real seconds (the token's iat does not change; wall-clock time
        # catches up), so we retry briefly instead of failing the request
        # outright. This is bounded (at most 2 extra attempts, ~1.5s total)
        # and does not weaken any other verification check.
        max_attempts = 3
        last_exc: Optional[Exception] = None
        for attempt in range(max_attempts):
            try:
                decoded = self._firebase_auth.verify_id_token(id_token)

                # Verify token audience (aud) matches expected Firebase project id
                aud = decoded.get("aud") or decoded.get("audience")
                if self.project_id and aud and str(aud) != str(self.project_id):
                    msg = f"Token audience mismatch: aud={aud} expected={self.project_id}"
                    _LOG.warning("%s", msg)
                    raise InvalidTokenError(msg)

                return decoded
            except Exception as ex:
                ex_msg = str(ex)
                if "used too early" in ex_msg.lower() and attempt < max_attempts - 1:
                    _LOG.warning("Token used too early (clock skew); retrying verification (attempt %d/%d)", attempt + 1, max_attempts)
                    time.sleep(0.6)
                    last_exc = ex
                    continue
                last_exc = ex
                break

        ex = last_exc
        ex_type = ex.__class__.__name__
        ex_msg = str(ex)
        safe_msg = f"{ex_type}: {ex_msg}"
        if "expired" in ex_msg.lower():
            raise ExpiredTokenError(safe_msg)
        raise InvalidTokenError(safe_msg)


def validate_firebase_credentials(raise_on_missing: bool = True) -> None:
    """Ensure Google/Firebase application credentials are available.

    Checks in order:
    - If GOOGLE_APPLICATION_CREDENTIALS is set, ensure the file exists.
    - Otherwise attempt to detect Application Default Credentials via
      google.auth.default() (this succeeds on GCP runtimes like Cloud Run).

    Raises RuntimeError when credentials cannot be located and
    raise_on_missing is True.
    """
    gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if gac:
        if not os.path.exists(gac):
            raise RuntimeError(f"GOOGLE_APPLICATION_CREDENTIALS is set to {gac} but file does not exist")
        return

    # Try to detect ADC (Application Default Credentials). This covers
    # environments like Cloud Run, GKE, or Compute Engine where metadata
    # credentials are available.
    try:
        import google.auth  # type: ignore

        creds, _project = google.auth.default()
        if creds is None:
            raise RuntimeError("google.auth.default() returned no credentials")
        return
    except Exception as exc:
        if raise_on_missing:
            raise RuntimeError(
                "No Google application credentials found. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file, "
                "use `gcloud auth application-default login` for local ADC, or run the service on GCP where ADC is provided."
            ) from exc


class AuthService:
    """High-level authentication service used by the application.

    It accepts a verifier object with a verify_id_token(id_token) -> dict method.
    If no verifier is supplied the FirebaseVerifier is used lazily.
    """

    def __init__(self, verifier: Optional[Any] = None):
        # do not keep mutable global firebase_admin state here; store verifier
        # reference which may be a FirebaseVerifier or a test double.
        self.verifier = verifier

    def verify_token(self, id_token: str) -> AuthenticatedUser:
        if not id_token:
            raise InvalidTokenError("Missing token")

        if self.verifier is None:
            self.verifier = FirebaseVerifier()

        decoded = self.verifier.verify_id_token(id_token)

        # Map firebase decoded token fields into AuthenticatedUser
        uid = decoded.get("uid") or decoded.get("user_id")
        email = decoded.get("email")
        name = decoded.get("name") or decoded.get("displayName")
        email_verified = bool(decoded.get("email_verified") or decoded.get("emailVerified") or False)

        # Extract custom claims. Some verifiers populate custom claims as
        # top-level keys while others place them under a nested 'claims'
        # dict. Flatten both shapes so user_has_role can check reliably.
        reserved = {"uid", "user_id", "email", "name", "displayName", "email_verified", "emailVerified", "iat", "exp", "aud", "iss"}
        claims: Dict[str, Any] = {k: v for k, v in decoded.items() if k not in reserved}
        nested = decoded.get("claims")
        if isinstance(nested, dict):
            # overlay nested claims into the top-level claims map without
            # overriding any explicitly present top-level keys.
            for k, v in nested.items():
                if k not in claims:
                    claims[k] = v

        return AuthenticatedUser(uid=uid, email=email, display_name=name, email_verified=email_verified, claims=claims)

    # convenience wrapper for role checks to keep route handlers compact
    def user_has_role(self, user: AuthenticatedUser, role: str) -> bool:
        return user_has_role(user, role)


def user_has_role(user: AuthenticatedUser, role: str) -> bool:
    # flexible checks for common claim shapes: 'roles' list, 'role' string, or standalone claim
    claims = user.claims or {}
    roles = claims.get("roles") or claims.get("role")
    if isinstance(roles, list):
        return role in roles
    if isinstance(roles, str):
        return roles == role
    # fallback: some systems set boolean custom claims like {'reliability_engineer': True}
    if claims.get(role) is True:
        return True
    return False
