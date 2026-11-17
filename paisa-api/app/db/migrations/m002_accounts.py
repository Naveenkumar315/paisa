"""Create an account for every (bank, last 4 digits) seen in transactions,
and point each transaction at its account.

Deterministic: the bank and last four digits are on every transaction, so
this backfill is exact. (statement_id is not backfilled: overlapping
statements make it impossible to say which upload a row came from.)
"""

from app.db.models import Transaction
from app.services import accounts_service

MISSING = {"$in": [None]}


async def run(dry_run: bool) -> dict:
    txns = Transaction.get_pymongo_collection()

    groups = await (await txns.aggregate(
        [
            {"$match": {"account_id": MISSING, "bank": {"$nin": ["", None]}}},
            {
                "$group": {
                    "_id": {"u": "$user_id", "bank": "$bank", "last4": "$account_last4"},
                    "n": {"$sum": 1},
                }
            },
        ]
    )).to_list()

    linked = 0
    for g in groups:
        linked += g["n"]
        if dry_run:
            continue
        user_id, bank, last4 = g["_id"]["u"], g["_id"]["bank"], g["_id"]["last4"]
        ids = await accounts_service.resolve(user_id, {(bank, last4)})
        await txns.update_many(
            {
                "user_id": user_id,
                "bank": bank,
                "account_last4": last4,
                "account_id": MISSING,
            },
            {"$set": {"account_id": ids[(bank, last4)]}},
        )

    return {"accounts_seen": len(groups), "transactions_linked": linked}
