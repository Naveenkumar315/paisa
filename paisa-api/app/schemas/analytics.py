from pydantic import BaseModel


class MonthSummary(BaseModel):
    month: str
    spending_paise: int
    transfers_paise: int
    received_paise: int
    self_transfer_paise: int
    txn_count: int


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
