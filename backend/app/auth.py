from __future__ import annotations
from typing import Any, Dict, Optional
import os

from pydantic import BaseModel


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
        self.project_id = project_id or os.environ.get("FIREBASE_PROJECT")
        self._firebase_auth = None

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
            if not firebase_admin._apps:
                firebase_admin.initialize_app()
        except Exception:
            # ignore initialization errors here; verify_id_token may still work
            pass

        self._firebase_auth = firebase_auth

    def verify_id_token(self, id_token: str) -> Dict[str, Any]:
        self._ensure_auth()
        try:
            decoded = self._firebase_auth.verify_id_token(id_token)
            return decoded
        except Exception as ex:
            # Map firebase errors to our simple exceptions and let caller handle
            msg = str(ex)
            if "expired" in msg.lower():
                raise ExpiredTokenError(msg)
            raise InvalidTokenError(msg)


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
        # custom claims live under 'claims' in firebase_admin result
        claims = {k: v for k, v in decoded.items() if k not in ("uid", "user_id", "email", "name", "displayName", "email_verified", "emailVerified", "iat", "exp", "aud", "iss")}

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
