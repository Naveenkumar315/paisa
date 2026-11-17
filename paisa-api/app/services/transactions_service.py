import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from beanie import PydanticObjectId

from app.core.errors import AppError, NotFound
from app.db.models import AuditLog, Transaction, utcnow
from app.services.categorize_service import CATEGORIES
from app.services.classification import ALL_TYPES, allowed_types, classify_stages

SORTS = {
    "newest": {"occurred_at": -1, "_id": -1},
    "oldest": {"occurred_at": 1, "_id": 1},
    "largest": {"amount_paise": -1, "_id": -1},
    "smallest": {"amount_paise": 1, "_id": 1},
}

UNCATEGORISED = "uncategorised"


@dataclass
class TxnFilter:
    date_from: date | None = None
    date_to: date | None = None            # inclusive
    direction: str | None = None
    types: list[str] | None = None
    category: str | None = None            # a category, or "uncategorised"
    account_id: PydanticObjectId | None = None
    statement_id: PydanticObjectId | None = None
    q: str | None = None                   # part of the payee name
    min_paise: int | None = None
    max_paise: int | None = None


def _validate(f: TxnFilter) -> None:
    if f.direction and f.direction not in ("debit", "credit"):
        raise AppError("direction must be debit or credit")
    for t in f.types or []:
        if t not in ALL_TYPES:
            raise AppError(f"Unknown type: {t}. Use one of {', '.join(ALL_TYPES)}")
    if f.category and f.category not in [*CATEGORIES, UNCATEGORISED]:
        raise AppError(f"Unknown category: {f.category}")
    if f.date_from and f.date_to and f.date_from > f.date_to:
        raise AppError("from must not be after to")
    if f.min_paise is not None and f.max_paise is not None and f.min_paise > f.max_paise:
        raise AppError("min must not be greater than max")


def _match(user_id: PydanticObjectId, f: TxnFilter) -> list[dict]:
    """Filters on stored fields go first, so they can use the indexes;
    filters on type and category can only run after classification."""
    m: dict[str, Any] = {"user_id": user_id}
    # occurred_at is the statement's wall-clock time with no timezone
    # (see models.Transaction), so plain midnight boundaries match it.
    when: dict[str, datetime] = {}
    if f.date_from:
        when["$gte"] = datetime.combine(f.date_from, time.min)
    if f.date_to:
        when["$lt"] = datetime.combine(f.date_to + timedelta(days=1), time.min)
    if when:
        m["occurred_at"] = when
    if f.direction:
        m["direction"] = f.direction
    if f.account_id:
        m["account_id"] = f.account_id
    if f.statement_id:
        m["statement_id"] = f.statement_id
    if f.q and f.q.strip():
        m["counterparty_raw"] = {"$regex": re.escape(f.q.strip()), "$options": "i"}
    amount: dict[str, int] = {}
    if f.min_paise is not None:
        amount["$gte"] = f.min_paise
    if f.max_paise is not None:
        amount["$lte"] = f.max_paise
    if amount:
        m["amount_paise"] = amount

    stages: list[dict] = [{"$match": m}, *classify_stages()]
    after: dict[str, Any] = {}
    if f.types:
        after["txn_type"] = {"$in": f.types}
    if f.category == UNCATEGORISED:
        after["category"] = None
    elif f.category:
        after["category"] = f.category
    if after:
        stages.append({"$match": after})
    return stages


def _out(d: dict) -> dict:
    def oid(v: Any) -> str | None:
        return str(v) if v is not None else None

    return {
        "id": str(d["_id"]),
        "txn_id": d["txn_id"],
        "occurred_at": d["occurred_at"],
        "direction": d["direction"],
        "is_self_transfer": d.get("is_self_transfer", False),
        "counterparty_raw": d["counterparty_raw"],
        "amount_paise": d["amount_paise"],
        "bank": d.get("bank", ""),
        "account_last4": d.get("account_last4", ""),
        "account_id": oid(d.get("account_id")),
        "statement_id": oid(d.get("statement_id")),
        "txn_type": d["txn_type"],
        "category": d.get("category"),
        "category_source": d.get("category_source"),
        "type_override": d.get("type_override"),
        "category_override": d.get("category_override"),
        "notes": d.get("notes"),
        "updated_at": d.get("updated_at"),
    }


async def list_transactions(
    user_id: PydanticObjectId,
    f: TxnFilter,
    sort: str = "newest",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    _validate(f)
    if sort not in SORTS:
        raise AppError(f"sort must be one of {', '.join(SORTS)}")

    pipeline = [
        *_match(user_id, f),
        {
            "$facet": {
                "items": [{"$sort": SORTS[sort]}, {"$skip": offset}, {"$limit": limit}],
                # Totals over everything that matched, not just this page,
                # so a filtered view can say what it adds up to.
                "totals": [
                    {
                        "$group": {
                            "_id": None,
                            "count": {"$sum": 1},
                            "debit": {
                                "$sum": {
                                    "$cond": [{"$eq": ["$direction", "debit"]}, "$amount_paise", 0]
                                }
                            },
                            "credit": {
                                "$sum": {
                                    "$cond": [{"$eq": ["$direction", "credit"]}, "$amount_paise", 0]
                                }
                            },
                        }
                    }
                ],
            }
        },
    ]
    rows = await Transaction.aggregate(pipeline).to_list()
    result = rows[0] if rows else {"items": [], "totals": []}
    totals = result["totals"][0] if result["totals"] else {}
    return {
        "items": [_out(d) for d in result["items"]],
        "total": totals.get("count", 0),
        "limit": limit,
        "offset": offset,
        "debit_paise": totals.get("debit", 0),
        "credit_paise": totals.get("credit", 0),
    }


async def get_transaction(user_id: PydanticObjectId, txn_id: PydanticObjectId) -> dict:
    rows = await Transaction.aggregate(
        [{"$match": {"_id": txn_id, "user_id": user_id}}, *classify_stages()]
    ).to_list()
    if not rows:
        # The same answer whether it does not exist or belongs to someone
        # else, so ids cannot be probed.
        raise NotFound("No such transaction")
    return _out(rows[0])


EDITABLE = ("type_override", "category_override", "notes")


async def update_transaction(
    user_id: PydanticObjectId, txn_id: PydanticObjectId, changes: dict[str, Any]
) -> dict:
    """Apply the person's overrides. None clears one.

    The amount, date, direction and payee are what the statement says,
    and stay that way: an import is evidence, an override is opinion,
    and the two are kept apart.
    """
    t = await Transaction.get(txn_id)
    if t is None or t.user_id != user_id:
        raise NotFound("No such transaction")

    unknown = set(changes) - set(EDITABLE)
    if unknown:
        raise AppError(f"Cannot change: {', '.join(sorted(unknown))}")

    if changes.get("type_override") is not None:
        allowed = allowed_types(t.direction)
        if changes["type_override"] not in allowed:
            raise AppError(
                f"A {t.direction} can be {', '.join(allowed)}; "
                f"not {changes['type_override']}"
            )
    if changes.get("category_override") is not None:
        if changes["category_override"] not in CATEGORIES:
            raise AppError(f"Unknown category: {changes['category_override']}")
    if "notes" in changes:
        notes = (changes["notes"] or "").strip()
        if len(notes) > 500:
            raise AppError("Notes are limited to 500 characters")
        changes["notes"] = notes or None

    diff = {k: [getattr(t, k), v] for k, v in changes.items() if getattr(t, k) != v}
    if diff:
        for k, (_, new) in diff.items():
            setattr(t, k, new)
        t.updated_at = utcnow()
        await t.save()
        await AuditLog(
            user_id=user_id, entity="transaction", entity_id=t.id,
            action="update", changes=diff,
        ).insert()
    return await get_transaction(user_id, t.id)


async def history(user_id: PydanticObjectId, txn_id: PydanticObjectId) -> list[dict]:
    await get_transaction(user_id, txn_id)      # ownership check
    logs = (
        await AuditLog.find(
            AuditLog.user_id == user_id,
            AuditLog.entity == "transaction",
            AuditLog.entity_id == txn_id,
        )
        .sort(-AuditLog.created_at)
        .to_list()
    )
    return [{"action": a.action, "changes": a.changes, "at": a.created_at} for a in logs]
