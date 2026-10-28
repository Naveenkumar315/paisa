from datetime import datetime, timezone

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Document):
    email: str
    name: str
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"
        indexes = [
            pymongo.IndexModel([("email", pymongo.ASCENDING)], unique=True),
        ]


class Transaction(Document):
    """One payment.

    amount_paise, not a float. 171.25 in binary floating point is
    171.2499999999999943..., and summing 400 of those drifts away from
    the statement total. Integers of the smallest unit never drift.
    """

    user_id: PydanticObjectId
    txn_id: str
    occurred_at: datetime
    direction: str                 # "debit" | "credit"
    is_self_transfer: bool = False
    counterparty_raw: str
    amount_paise: int
    bank: str = ""
    account_last4: str = ""
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "transactions"
        indexes = [
            # The dedupe. Re-importing an overlapping statement cannot
            # create a second copy, whatever the code does.
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("txn_id", pymongo.ASCENDING)],
                unique=True,
            ),
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING),
                 ("occurred_at", pymongo.DESCENDING)]
            ),
        ]


class Statement(Document):
    """One uploaded PDF. Kept so an import can be traced."""

    user_id: PydanticObjectId
    original_filename: str
    file_key: str
    period_start: datetime | None = None
    period_end: datetime | None = None
    rows_parsed: int = 0
    rows_inserted: int = 0
    rows_duplicate: int = 0
    imported_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "statements"


class Payee(Document):
    """One payee, with whatever category we have for it.

    source tells you who decided: the model, or the person. A user's
    answer is never overwritten by a later model run.
    """

    user_id: PydanticObjectId
    name: str
    category: str | None = None
    source: str | None = None       # "llm" | "user"
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "payees"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("name", pymongo.ASCENDING)],
                unique=True,
            ),
        ]


DOCUMENT_MODELS = [User, Statement, Transaction, Payee]
