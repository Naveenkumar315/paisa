from beanie import PydanticObjectId
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import Unauthorized
from app.core.security import decode_access_token
from app.db.models import User

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> User:
    """Add this to a route and it becomes protected.

    Express: router.get("/me", requireAuth, handler)
    Here:    async def me(user: User = Depends(get_current_user))
    """
    if creds is None:
        raise Unauthorized("Missing bearer token")

    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise Unauthorized("Invalid or expired token")

    user = await User.get(PydanticObjectId(user_id))
    if user is None:
        raise Unauthorized("User no longer exists")

    return user
