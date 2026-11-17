from pydantic import BaseModel


class MonthSummary(BaseModel):
    month: str
    spending_paise: int
    transfers_paise: int
    received_paise: int
    self_transfer_paise: int
    txn_count: int
    # Sprint 1: the same money split by transaction type.
    # expenses + transfers = spending; income + transfers_in + refunds = received.
    expenses_paise: int = 0
    income_paise: int = 0
    transfers_in_paise: int = 0
    refunds_paise: int = 0


class PayeeSummary(BaseModel):
    name: str
    count: int
    total_paise: int
    avg_paise: int
    category: str | None


class ClockBucket(BaseModel):
    bucket: str
    count: int
    amount_paise: int


class CategorySlice(BaseModel):
    name: str
    amount_paise: int
    pct: int
