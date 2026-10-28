from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user
from app.core.security import create_access_token
from app.db.models import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.name,
        created_at=user.created_at,
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn):
    user = await auth_service.register_user(body)
    return TokenOut(access_token=create_access_token(str(user.id)), user=_to_out(user))


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
    user = await auth_service.authenticate(body)
    return TokenOut(access_token=create_access_token(str(user.id)), user=_to_out(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _to_out(user)
