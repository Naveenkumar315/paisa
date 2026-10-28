from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.api.deps import get_current_user
from app.db.models import Statement, Transaction, User
from app.schemas.statements import StatementOut, TransactionOut, TransactionPage
from app.services import import_service

router = APIRouter(prefix="/statements", tags=["statements"])


def _out(s: Statement) -> StatementOut:
    return StatementOut(
        id=str(s.id),
        original_filename=s.original_filename,
        period_start=s.period_start,
        period_end=s.period_end,
        rows_parsed=s.rows_parsed,
        rows_inserted=s.rows_inserted,
        rows_duplicate=s.rows_duplicate,
        imported_at=s.imported_at,
    )


@router.post("", response_model=StatementOut, status_code=status.HTTP_201_CREATED)
async def upload_statement(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    data = await file.read()
    statement = await import_service.import_statement(
        user.id, file.filename or "statement.pdf", data
    )
    return _out(statement)


@router.get("", response_model=list[StatementOut])
async def list_statements(user: User = Depends(get_current_user)):
    rows = (
        await Statement.find(Statement.user_id == user.id)
        .sort(-Statement.imported_at)
        .to_list()
    )
    return [_out(s) for s in rows]


@router.get("/transactions", response_model=TransactionPage)
async def list_transactions(
    user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    query = Transaction.find(Transaction.user_id == user.id)
    total = await query.count()
    rows = await query.sort(-Transaction.occurred_at).skip(offset).limit(limit).to_list()
    return TransactionPage(
        items=[
            TransactionOut(
                id=str(t.id), txn_id=t.txn_id, occurred_at=t.occurred_at,
                direction=t.direction, is_self_transfer=t.is_self_transfer,
                counterparty_raw=t.counterparty_raw, amount_paise=t.amount_paise,
                bank=t.bank, account_last4=t.account_last4,
            )
            for t in rows
        ],
        total=total, limit=limit, offset=offset,
    )
