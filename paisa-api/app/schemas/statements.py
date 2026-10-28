from datetime import datetime

from pydantic import BaseModel, computed_field


class StatementOut(BaseModel):
    id: str
    original_filename: str
    period_start: datetime | None
    period_end: datetime | None
    rows_parsed: int
    rows_inserted: int
    rows_duplicate: int
    imported_at: datetime


class TransactionOut(BaseModel):
    id: str
    txn_id: str
    occurred_at: datetime
    direction: str
    is_self_transfer: bool
    counterparty_raw: str
    amount_paise: int
    bank: str
    account_last4: str

    @computed_field
    @property
    def amount(self) -> str:
        """Rupees for display. Paise stay authoritative."""
        return f"{self.amount_paise / 100:.2f}"


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    limit: int
    offset: int
