from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from travel_planner.config import settings

http_bearer = HTTPBearer()


@dataclass
class AuthUser:
    id: UUID
    email: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
) -> AuthUser:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = UUID(payload["sub"])
        email = payload["email"]
        return AuthUser(id=user_id, email=email)
    except (jwt.InvalidTokenError, KeyError, ValueError) as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from e


def get_current_user_id(user: AuthUser = Depends(get_current_user)) -> UUID:
    return user.id


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
