"""Give every payee a normalized_name and every transaction a payee_key.

Classification joins transactions to payees on these two fields. Without
them a transaction finds no payee and drops to uncategorised.
"""

from app.db.models import Payee, Transaction
from app.services.payee_normalize import normalize_name

MISSING = {"$in": [None]}   # matches both null and absent


async def run(dry_run: bool) -> dict:
    payees = Payee.get_pymongo_collection()
    txns = Transaction.get_pymongo_collection()

    payees_set = 0
    async for p in payees.find({"normalized_name": MISSING}, {"name": 1}):
        payees_set += 1
        if not dry_run:
            await payees.update_one(
                {"_id": p["_id"], "normalized_name": MISSING},
                {"$set": {"normalized_name": normalize_name(p["name"])}},
            )

    # One update per distinct name, not per transaction.
    pairs = await (await txns.aggregate(
        [
            {"$match": {"payee_key": MISSING}},
            {
                "$group": {
                    "_id": {"u": "$user_id", "name": "$counterparty_raw"},
                    "n": {"$sum": 1},
                }
            },
        ]
    )).to_list()

    txns_set = 0
    for row in pairs:
        txns_set += row["n"]
        if not dry_run:
            await txns.update_many(
                {
                    "user_id": row["_id"]["u"],
                    "counterparty_raw": row["_id"]["name"],
                    "payee_key": MISSING,
                },
                {"$set": {"payee_key": normalize_name(row["_id"]["name"])}},
            )

    return {"payees_set": payees_set, "transactions_set": txns_set}
