from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.core.errors import AppError, NotFound
from app.db.models import Account, AuditLog, Transaction, utcnow

ACCOUNT_TYPES = [
    "bank",          # a bank account of unknown kind; what a GPay statement tells us
    "savings",
    "current",
    "credit_card",
    "cash",
    "wallet",
    "investment",
]


def default_name(institution: str, last4: str) -> str:
    return f"{institution} ··{last4}"


async def resolve(
    user_id: PydanticObjectId, pairs: set[tuple[str, str]]
) -> dict[tuple[str, str], PydanticObjectId]:
    """Account id for each (bank, last4), creating the ones that are new.

    Insert first and let the unique index catch an account that already
    exists, rather than check-then-insert, which two concurrent imports
    would both pass.
    """
    out: dict[tuple[str, str], PydanticObjectId] = {}
    for institution, last4 in pairs:
        if not institution:
            continue
        found = await Account.find_one(
            Account.user_id == user_id,
            Account.institution == institution,
            Account.last4 == last4,
        )
        if found is None:
            try:
                found = await Account(
                    user_id=user_id,
                    institution=institution,
                    last4=last4,
                    name=default_name(institution, last4),
                ).insert()
            except DuplicateKeyError:
                found = await Account.find_one(
                    Account.user_id == user_id,
                    Account.institution == institution,
                    Account.last4 == last4,
                )
        out[(institution, last4)] = found.id
    return out


async def list_accounts(user_id: PydanticObjectId) -> list[dict]:
    """Every account with what its transactions add up to.

    Totals are money that moved through the account in the imported
    statements, not a balance: a GPay statement never states one.
    """
    accounts = await Account.find(Account.user_id == user_id).sort(Account.created_at).to_list()
    stats = await Transaction.aggregate(
        [
            {"$match": {"user_id": user_id, "account_id": {"$ne": None}}},
            {
                "$group": {
                    "_id": "$account_id",
                    "count": {"$sum": 1},
                    "debit": {
                        "$sum": {"$cond": [{"$eq": ["$direction", "debit"]}, "$amount_paise", 0]}
                    },
                    "credit": {
                        "$sum": {"$cond": [{"$eq": ["$direction", "credit"]}, "$amount_paise", 0]}
                    },
                    "first": {"$min": "$occurred_at"},
                    "last": {"$max": "$occurred_at"},
                }
            },
        ]
    ).to_list()
    by_id = {s["_id"]: s for s in stats}
    return [_out(a, by_id.get(a.id)) for a in accounts]


def _out(a: Account, s: dict | None) -> dict:
    s = s or {}
    return {
        "id": str(a.id),
        "name": a.name,
        "institution": a.institution,
        "last4": a.last4,
        "account_type": a.account_type,
        "currency": a.currency,
        "is_active": a.is_active,
        "txn_count": s.get("count", 0),
        "debit_paise": s.get("debit", 0),
        "credit_paise": s.get("credit", 0),
        "first_txn_at": s.get("first"),
        "last_txn_at": s.get("last"),
        # Said out loud, so no screen is tempted to show a made-up one.
        "balance_paise": None,
    }


async def get_account(user_id: PydanticObjectId, account_id: PydanticObjectId) -> dict:
    a = await Account.get(account_id)
    if a is None or a.user_id != user_id:
        raise NotFound("No such account")
    rows = await list_accounts(user_id)
    return next(r for r in rows if r["id"] == str(a.id))


async def update_account(
    user_id: PydanticObjectId, account_id: PydanticObjectId, changes: dict
) -> dict:
    a = await Account.get(account_id)
    if a is None or a.user_id != user_id:
        raise NotFound("No such account")

    if "account_type" in changes and changes["account_type"] not in ACCOUNT_TYPES:
        raise AppError(f"Unknown account type: {changes['account_type']}")
    if "name" in changes:
        changes["name"] = (changes["name"] or "").strip() or default_name(a.institution, a.last4)

    diff = {k: [getattr(a, k), v] for k, v in changes.items() if getattr(a, k) != v}
    if diff:
        for k, (_, new) in diff.items():
            setattr(a, k, new)
        await a.save()
        await AuditLog(
            user_id=user_id, entity="account", entity_id=a.id,
            action="update", changes=diff, created_at=utcnow(),
        ).insert()
    return await get_account(user_id, a.id)
