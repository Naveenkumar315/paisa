from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.errors import AppError, NotFound
from app.db.models import Payee, User
from app.services import categorize_service

router = APIRouter(prefix="/payees", tags=["payees"])


class PayeeOut(BaseModel):
    name: str
    category: str | None
    source: str | None


class SetCategoryIn(BaseModel):
    category: str


@router.post("/categorize")
async def categorize(user: User = Depends(get_current_user)):
    return await categorize_service.categorize_all(user.id)


@router.get("", response_model=list[PayeeOut])
async def list_payees(user: User = Depends(get_current_user)):
    rows = await Payee.find(Payee.user_id == user.id).to_list()
    return [
        PayeeOut(name=p.name, category=p.category, source=p.source) for p in rows
    ]


@router.put("/{name}", response_model=PayeeOut)
async def set_category(
    name: str, body: SetCategoryIn, user: User = Depends(get_current_user)
):
    if body.category not in categorize_service.CATEGORIES:
        raise AppError(f"Unknown category: {body.category}")

    payee = await Payee.find_one(Payee.user_id == user.id, Payee.name == name)
    if payee is None:
        raise NotFound(f"No payee named {name}")

    payee.category = body.category
    payee.source = "user"      # from now on the model leaves this alone
    await payee.save()
    return PayeeOut(name=payee.name, category=payee.category, source=payee.source)
