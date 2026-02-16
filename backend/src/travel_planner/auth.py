from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWKClientError
from jwt.jwks_client import PyJWKClient

from travel_planner.config import settings

http_bearer = HTTPBearer()

# Singleton JWKS client for asymmetric verification with automatic caching
# Cache TTL: 1 hour (balances security and performance)
jwks_client = PyJWKClient(
    uri=f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
    cache_jwk_set=True,  # Cache entire JWK set
    lifespan=3600,  # 1 hour TTL
    cache_keys=True,  # Also cache individual keys by kid
    max_cached_keys=16,  # Reasonable for key rotation
    timeout=10,  # Network timeout for JWKS fetch
)


@dataclass
class AuthUser:
    id: UUID
    email: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> AuthUser:
    token = credentials.credentials
    try:
        # Get signing key from JWKS (auto-fetches and caches)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode with asymmetric verification (RS256 or ES256)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
            issuer=f"{settings.supabase_url}/auth/v1",
        )
        user_id = UUID(payload["sub"])
        email = payload.get("email", "")
        return AuthUser(id=user_id, email=email)
    except (jwt.InvalidTokenError, KeyError, ValueError) as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from e
    except PyJWKClientError as e:
        # Network/JWKS fetch errors
        raise HTTPException(status_code=401, detail="Could not validate token") from e


def get_current_user_id(user: AuthUser = Depends(get_current_user)) -> UUID:
    return user.id


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
