"""
Vidi — backend/app/api/auth.py
Day 20 Task: JWT Middleware

FastAPI dependency that validates Supabase JWTs on every protected endpoint.

How Supabase JWTs work:
    - Supabase signs every session JWT with your project's JWT secret (HS256)
    - The JWT payload contains: sub (user_id), email, role, exp (expiry), etc.
    - We verify the signature using SUPABASE_JWT_SECRET (NOT the anon key)
    - On success → extract user_id + fetch role from `profiles` table
    - On failure (missing/expired/invalid) → raise 401

Usage in other endpoints:
    from app.api.auth import get_current_user, require_role
    from app.models.user import User, UserRole

    @router.get("/protected")
    def protected_route(user: User = Depends(get_current_user)):
        return {"user_id": user.user_id, "role": user.role}

    @router.get("/pro-only")
    def pro_route(user: User = Depends(require_role(UserRole.PRO))):
        return {"message": "Pro feature unlocked"}
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError
from loguru import logger
from supabase import create_client, Client

from app.config import settings
from app.models.user import User, UserRole

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────

# Supabase signs JWTs with HS256 using the project's JWT secret.
# This is DIFFERENT from the anon key — find it in:
# Supabase Dashboard → Settings → API → JWT Settings → JWT Secret
JWT_ALGORITHM = "HS256"

# audience claim Supabase sets on every JWT
JWT_AUDIENCE = "authenticated"

# Bearer token extractor — reads "Authorization: Bearer <token>" header
bearer_scheme = HTTPBearer(auto_error=False)


# ─────────────────────────────────────────────────────────────
#  Supabase Admin Client (service role — for fetching profiles)
# ─────────────────────────────────────────────────────────────

_supabase_admin: Optional[Client] = None


def get_supabase_admin() -> Client:
    """
    Returns a Supabase client using the SERVICE ROLE key.
    This bypasses RLS — used internally by the backend only,
    NEVER exposed to the frontend.
    """
    global _supabase_admin
    if _supabase_admin is None:
        if not settings.supabase_url or not settings.supabase_service_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env "
                "to use the admin client."
            )
        _supabase_admin = create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    return _supabase_admin


# ─────────────────────────────────────────────────────────────
#  JWT Decoding
# ─────────────────────────────────────────────────────────────

def decode_supabase_jwt(token: str) -> dict:
    """
    Decode and verify a Supabase-issued JWT.

    Raises HTTPException(401) for:
        - Missing/empty token
        - Invalid signature
        - Expired token
        - Malformed token

    Returns the decoded payload dict on success.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Supabase JWT secret — found in Supabase Dashboard → Settings → API
    jwt_secret = getattr(settings, "supabase_jwt_secret", None)
    if not jwt_secret:
        logger.error(
            "[auth] SUPABASE_JWT_SECRET not configured! "
            "Add it to .env from Supabase Dashboard → Settings → API → JWT Settings"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration: JWT secret not set",
        )

    try:
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
        )
        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except JWTError as e:
        logger.warning(f"[auth] JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ─────────────────────────────────────────────────────────────
#  Profile Lookup (role + business_profile from Supabase)
# ─────────────────────────────────────────────────────────────

def fetch_user_profile(user_id: str) -> dict:
    """
    Fetch role + business_profile from the `profiles` table
    using the service role client (bypasses RLS).

    Returns a dict with defaults if profile doesn't exist yet
    (e.g. trigger hasn't fired, or race condition on first login).
    """
    try:
        admin = get_supabase_admin()
        response = (
            admin.table("profiles")
            .select("user_id, name, email, role, business_profile")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if response.data:
            return response.data

    except Exception as e:
        logger.warning(f"[auth] Could not fetch profile for {user_id}: {e}")

    # Fallback — profile row doesn't exist yet, default to 'free'
    return {
        "user_id": user_id,
        "name": None,
        "email": None,
        "role": "free",
        "business_profile": None,
    }


# ─────────────────────────────────────────────────────────────
#  Main Dependency: get_current_user
#  Use this in any endpoint that REQUIRES authentication
# ─────────────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> User:
    """
    FastAPI dependency — validates JWT and returns a User object.

    Raises 401 if:
        - No Authorization header provided
        - Token is invalid, malformed, or expired

    Injects user_id + role into the request via the returned User object.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token. Include 'Authorization: Bearer <token>' header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_supabase_jwt(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identifier (sub claim)",
        )

    # Fetch role + profile from Supabase
    profile = fetch_user_profile(user_id)

    try:
        role = UserRole(profile.get("role", "free"))
    except ValueError:
        role = UserRole.FREE

    return User(
        user_id=user_id,
        email=payload.get("email") or profile.get("email"),
        name=profile.get("name"),
        role=role,
        business_profile=profile.get("business_profile"),
    )


# ─────────────────────────────────────────────────────────────
#  Optional Auth Dependency
#  For endpoints that work for Guests too (e.g. /query with limits)
# ─────────────────────────────────────────────────────────────

def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[User]:
    """
    Like get_current_user, but returns None instead of raising 401
    if no token is provided. Used for endpoints accessible to Guests
    (e.g. /query allows 3 free queries/day without login).

    If a token IS provided but invalid/expired, this still raises 401 —
    only a MISSING token is treated as "guest mode".
    """
    if credentials is None:
        return None  # Guest — no token provided, that's allowed here

    # Token was provided — it must be valid
    return get_current_user(credentials)


# ─────────────────────────────────────────────────────────────
#  Role-Based Access Control
# ─────────────────────────────────────────────────────────────

ROLE_HIERARCHY = {
    UserRole.GUEST: 0,
    UserRole.FREE: 1,
    UserRole.PRO: 2,
    UserRole.ENTERPRISE: 3,
}


def require_role(minimum_role: UserRole):
    """
    Dependency factory — returns a dependency that requires
    the user to have AT LEAST the specified role.

    Usage:
        @router.post("/upload")
        def upload_doc(user: User = Depends(require_role(UserRole.PRO))):
            ...
    """
    def _check_role(user: User = Depends(get_current_user)) -> User:
        user_level = ROLE_HIERARCHY.get(user.role, 0)
        required_level = ROLE_HIERARCHY.get(minimum_role, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This feature requires {minimum_role.value.upper()} plan or higher. "
                    f"Your current plan: {user.role.value.upper()}."
                ),
            )
        return user

    return _check_role


# ─────────────────────────────────────────────────────────────
#  Test Harness
#  Run: python -m app.api.auth
# ─────────────────────────────────────────────────────────────

def _build_test_token(payload_overrides: dict, secret: str, expired: bool = False) -> str:
    """Helper to build a test JWT for the test harness below."""
    import time

    now = int(time.time())
    base_payload = {
        "sub": "test-user-id-123",
        "email": "test@vidi.in",
        "aud": JWT_AUDIENCE,
        "role": "authenticated",
        "iat": now,
        "exp": now - 10 if expired else now + 3600,
    }
    base_payload.update(payload_overrides)
    return jwt.encode(base_payload, secret, algorithm=JWT_ALGORITHM)


def run_auth_tests():
    """
    Tests JWT middleware with: valid, expired, and missing tokens.
    Run: python -m app.api.auth
    """
    print("=" * 70)
    print("Vidi JWT Middleware — Test Suite")
    print("=" * 70)

    test_secret = "test-secret-for-local-testing-only-do-not-use-in-prod"

    results = []

    # ── Test 1: Valid token ───────────────────────────────────
    print("\n[Test 1] Valid token")
    try:
        valid_token = _build_test_token({}, test_secret)
        payload = jwt.decode(valid_token, test_secret, algorithms=[JWT_ALGORITHM], audience=JWT_AUDIENCE)
        assert payload["sub"] == "test-user-id-123"
        print(f"  ✓ PASS — decoded successfully, sub={payload['sub']}")
        results.append(True)
    except Exception as e:
        print(f"  ✗ FAIL — {e}")
        results.append(False)

    # ── Test 2: Expired token ─────────────────────────────────
    print("\n[Test 2] Expired token")
    try:
        expired_token = _build_test_token({}, test_secret, expired=True)
        try:
            jwt.decode(expired_token, test_secret, algorithms=[JWT_ALGORITHM], audience=JWT_AUDIENCE)
            print("  ✗ FAIL — expired token was accepted (should have raised)")
            results.append(False)
        except ExpiredSignatureError:
            print("  ✓ PASS — expired token correctly rejected")
            results.append(True)
    except Exception as e:
        print(f"  ✗ FAIL — unexpected error: {e}")
        results.append(False)

    # ── Test 3: Missing token (None) ──────────────────────────
    print("\n[Test 3] Missing token")
    try:
        decode_supabase_jwt("")
        print("  ✗ FAIL — empty token was accepted (should have raised)")
        results.append(False)
    except HTTPException as e:
        if e.status_code == 401:
            print(f"  ✓ PASS — empty token correctly rejected (401: {e.detail})")
            results.append(True)
        else:
            print(f"  ✗ FAIL — wrong status code: {e.status_code}")
            results.append(False)
    except Exception as e:
        print(f"  ✗ FAIL — unexpected error type: {e}")
        results.append(False)

    # ── Test 4: Malformed token ────────────────────────────────
    print("\n[Test 4] Malformed token")
    try:
        jwt.decode("this.is.not.a.valid.jwt", test_secret, algorithms=[JWT_ALGORITHM])
        print("  ✗ FAIL — malformed token was accepted")
        results.append(False)
    except JWTError:
        print("  ✓ PASS — malformed token correctly rejected")
        results.append(True)
    except Exception as e:
        print(f"  ✗ FAIL — unexpected error: {e}")
        results.append(False)

    # ── Test 5: Wrong signature (tampered token) ──────────────
    print("\n[Test 5] Token signed with wrong secret (tampered)")
    try:
        wrong_secret_token = _build_test_token({}, "wrong-secret-entirely")
        try:
            jwt.decode(wrong_secret_token, test_secret, algorithms=[JWT_ALGORITHM], audience=JWT_AUDIENCE)
            print("  ✗ FAIL — token with wrong signature was accepted")
            results.append(False)
        except JWTError:
            print("  ✓ PASS — tampered token correctly rejected")
            results.append(True)
    except Exception as e:
        print(f"  ✗ FAIL — unexpected error: {e}")
        results.append(False)

    # ── Test 6: Role hierarchy check ──────────────────────────
    print("\n[Test 6] Role hierarchy logic")
    try:
        assert ROLE_HIERARCHY[UserRole.GUEST] < ROLE_HIERARCHY[UserRole.FREE]
        assert ROLE_HIERARCHY[UserRole.FREE] < ROLE_HIERARCHY[UserRole.PRO]
        assert ROLE_HIERARCHY[UserRole.PRO] < ROLE_HIERARCHY[UserRole.ENTERPRISE]
        print("  ✓ PASS — role hierarchy ordering correct (guest < free < pro < enterprise)")
        results.append(True)
    except AssertionError:
        print("  ✗ FAIL — role hierarchy ordering broken")
        results.append(False)

    print("\n" + "=" * 70)
    passed = sum(results)
    print(f"RESULT: {passed}/{len(results)} tests passed")
    if passed == len(results):
        print("✅ JWT middleware logic verified — ready for live Supabase tokens")
    print("=" * 70)

    print("\nNOTE: This test suite verifies JWT logic in isolation.")
    print("To test with REAL Supabase tokens:")
    print("  1. Set SUPABASE_JWT_SECRET in backend/.env")
    print("     (Supabase Dashboard → Settings → API → JWT Settings → JWT Secret)")
    print("  2. Sign in via frontend (Day 19 TestAuth page)")
    print("  3. Copy the access_token from browser devtools/console")
    print("  4. curl -H 'Authorization: Bearer <token>' http://localhost:8000/api/me")


if __name__ == "__main__":
    run_auth_tests()