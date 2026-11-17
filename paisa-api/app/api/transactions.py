from datetime import date

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.db.models import User
from app.services import transactions_service
from app.services.transactions_service import TxnFilter

router = APIRouter(prefix="/transactions", tags=["transactions"])


class TransactionPatch(BaseModel):
    """Only the fields sent are changed; send null to clear one."""

    type_override: str | None = None
    category_override: str | None = None
    notes: str | None = Field(default=None, max_length=500)


def _rupees_to_paise(v: float | None) -> int | None:
    return round(v * 100) if v is not None else None


@router.get("")
async def list_transactions(
    user: User = Depends(get_current_user),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    direction: str | None = None,
    type: list[str] | None = Query(None, description="Repeat for several: type=expense&type=refund"),
    category: str | None = None,
    account_id: PydanticObjectId | None = None,
    statement_id: PydanticObjectId | None = None,
    q: str | None = Query(None, max_length=100),
    min_rupees: float | None = Query(None, ge=0),
    max_rupees: float | None = Query(None, ge=0),
    sort: str = "newest",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    f = TxnFilter(
        date_from=date_from,
        date_to=date_to,
        direction=direction,
        types=type,
        category=category,
        account_id=account_id,
        statement_id=statement_id,
        q=q,
        min_paise=_rupees_to_paise(min_rupees),
        max_paise=_rupees_to_paise(max_rupees),
    )
    return await transactions_service.list_transactions(user.id, f, sort, limit, offset)


@router.get("/{txn_id}")
async def get_transaction(txn_id: PydanticObjectId, user: User = Depends(get_current_user)):
    return await transactions_service.get_transaction(user.id, txn_id)


@router.patch("/{txn_id}")
async def update_transaction(
    txn_id: PydanticObjectId,
    body: TransactionPatch,
    user: User = Depends(get_current_user),
):
    changes = body.model_dump(include=body.model_fields_set)
    return await transactions_service.update_transaction(user.id, txn_id, changes)


@router.get("/{txn_id}/history")
async def transaction_history(txn_id: PydanticObjectId, user: User = Depends(get_current_user)):
    return await transactions_service.history(user.id, txn_id)
