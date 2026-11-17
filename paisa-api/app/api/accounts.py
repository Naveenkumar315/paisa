from beanie import PydanticObjectId
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.db.models import User
from app.services import accounts_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


class AccountPatch(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    account_type: str | None = None
    is_active: bool | None = None


@router.get("")
async def list_accounts(user: User = Depends(get_current_user)):
    return await accounts_service.list_accounts(user.id)


@router.get("/types")
async def account_types():
    return accounts_service.ACCOUNT_TYPES


@router.get("/{account_id}")
async def get_account(account_id: PydanticObjectId, user: User = Depends(get_current_user)):
    return await accounts_service.get_account(user.id, account_id)


@router.patch("/{account_id}")
async def update_account(
    account_id: PydanticObjectId,
    body: AccountPatch,
    user: User = Depends(get_current_user),
):
    # Fields left out are left alone. A null name resets it to the default.
    changes = body.model_dump(include=body.model_fields_set)
    for k in ("account_type", "is_active"):
        if k in changes and changes[k] is None:
            changes.pop(k)
    return await accounts_service.update_account(user.id, account_id, changes)
