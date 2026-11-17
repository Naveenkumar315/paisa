from datetime import datetime, timezone

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Any


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


class Account(Document):
    """One of the person's own accounts, as a statement names it.

    A Google Pay statement says which bank account each payment used
    ("Axis Bank 1714") but never what is in it, so there is no balance
    here. Balances arrive with a bank-statement importer, not before.
    """

    user_id: PydanticObjectId
    institution: str                # "Axis Bank"
    last4: str
    name: str                       # the person's nickname, defaults to "Axis Bank ··1714"
    account_type: str = "bank"      # see accounts_service.ACCOUNT_TYPES
    currency: str = "INR"
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "accounts"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING),
                 ("institution", pymongo.ASCENDING),
                 ("last4", pymongo.ASCENDING)],
                unique=True,
            ),
        ]


class Transaction(Document):
    """One payment.

    amount_paise, not a float. 171.25 in binary floating point is
    171.2499999999999943..., and summing 400 of those drifts away from
    the statement total. Integers of the smallest unit never drift.

    occurred_at is the statement's own wall-clock time (IST) with no
    timezone, and every query buckets it the same way. Do not add a
    timezone to one query without changing them all.

    What a transaction *is* (expense, transfer, refund...) is not stored:
    services/classification.py works it out on every query, so a payee
    relabelled today is right in every past month too. Only the person's
    own overrides are stored.
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

    # Added in Sprint 1. Optional, so documents written before stay valid;
    # migrations backfill what can be backfilled.
    payee_key: str | None = None            # payee_normalize.normalize_name(counterparty_raw)
    statement_id: PydanticObjectId | None = None   # None for imports made before it was stored
    account_id: PydanticObjectId | None = None
    type_override: str | None = None        # set by the person; see classification.ALL_TYPES
    category_override: str | None = None
    notes: str | None = None
    updated_at: datetime | None = None

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
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING),
                 ("account_id", pymongo.ASCENDING),
                 ("occurred_at", pymongo.DESCENDING)]
            ),
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("statement_id", pymongo.ASCENDING)]
            ),
        ]


class Statement(Document):
    """One import of an uploaded PDF, kept so it can be traced. The PDF itself is not."""

    user_id: PydanticObjectId
    original_filename: str
    period_start: datetime | None = None
    period_end: datetime | None = None
    rows_parsed: int = 0
    rows_inserted: int = 0
    rows_duplicate: int = 0
    imported_at: datetime = Field(default_factory=utcnow)

    # Added in Sprint 1.
    # sha256 of the uploaded bytes. Cleared if the import fails, so the
    # same file can be tried again.
    file_hash: str | None = None
    status: str = "completed"       # "processing" | "completed" | "failed"
    rows_failed: int = 0            # payment lines the parser saw but could not read
    total_debit_paise: int | None = None
    total_credit_paise: int | None = None

    class Settings:
        name = "statements"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("imported_at", pymongo.DESCENDING)]
            ),
            # The same file twice is refused by the database, not by a
            # check-then-insert two concurrent uploads would both pass.
            # Partial, because statements from before Sprint 1 have no hash.
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("file_hash", pymongo.ASCENDING)],
                unique=True,
                partialFilterExpression={"file_hash": {"$type": "string"}},
                name="user_file_hash_unique",
            ),
        ]


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
    # Transactions join on this, not on name, so spellings that differ
    # only in case or spacing share one category.
    normalized_name: str | None = None

    class Settings:
        name = "payees"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("name", pymongo.ASCENDING)],
                unique=True,
            ),
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING), ("normalized_name", pymongo.ASCENDING)]
            ),
        ]


class AuditLog(Document):
    """Who changed what on a financial record, and from what to what."""

    user_id: PydanticObjectId
    entity: str                     # "transaction" | "account"
    entity_id: PydanticObjectId
    action: str                     # "update"
    changes: dict[str, Any]         # {"field": [old, new]}
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "audit_logs"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING),
                 ("entity", pymongo.ASCENDING),
                 ("entity_id", pymongo.ASCENDING),
                 ("created_at", pymongo.DESCENDING)]
            ),
        ]


class MigrationRecord(Document):
    """One applied data migration. See app/db/migrations."""

    name: str
    applied_at: datetime = Field(default_factory=utcnow)
    result: dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "migrations"
        indexes = [pymongo.IndexModel([("name", pymongo.ASCENDING)], unique=True)]


class AgentRun(Document):
    user_id: PydanticObjectId
    question: str
    answer: str | None = None
    steps: int = 0
    tokens: int = 0
    duration_ms: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    thread_id: PydanticObjectId | None = None

    class Settings:
        name = "agent_runs"
        indexes = [
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING),
                 ("created_at", pymongo.DESCENDING)]
            ),
            # History lookup filters on user and thread, then sorts by
            # time, so the fields have to sit in that order.
            pymongo.IndexModel(
                [("user_id", pymongo.ASCENDING),
                 ("thread_id", pymongo.ASCENDING),
                 ("created_at", pymongo.DESCENDING)]
            ),
        ]


class AgentStep(Document):
    """One think, tool call or answer. The trace screen is a query here."""

    run_id: PydanticObjectId
    step_no: int
    kind: str                       # "tool" | "retry" | "answer"
    tool_name: str | None = None
    arguments: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    duration_ms: int = 0
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "agent_steps"
        indexes = [
            pymongo.IndexModel(
                [("run_id", pymongo.ASCENDING), ("step_no", pymongo.ASCENDING)]),
        ]


DOCUMENT_MODELS = [
    User, Account, Statement, Transaction, Payee,
    AuditLog, MigrationRecord, AgentRun, AgentStep,
]
