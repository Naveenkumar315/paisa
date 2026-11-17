from beanie import PydanticObjectId

from app.db.models import Transaction
from app.services.classification import (
    EXPENSE,
    INCOME,
    REFUND,
    SELF_TRANSFER,
    SPENDING_MATCH,
    SPENDING_TYPES,
    TRANSFER_IN,
    TRANSFER_MIN_PAISE,  # noqa: F401  re-exported for older imports
    TRANSFER_OUT,
    classify_stages,
)


def _with_category() -> list[dict]:
    """Attach each transaction's category and type. Kept under its old
    name; the decision itself lives in services/classification.py."""
    return classify_stages()


async def monthly_summaries(user_id: PydanticObjectId) -> list[dict]:
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {
            "$group": {
                "_id": {
                    "month": {
                        "$dateToString": {"format": "%Y-%m", "date": "$occurred_at"}
                    },
                    "txn_type": "$txn_type",
                },
                "total": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        },
        {
            "$group": {
                "_id": "$_id.month",
                "buckets": {
                    "$push": {
                        "txn_type": "$_id.txn_type",
                        "total": "$total",
                        "count": "$count",
                    }
                },
            }
        },
        {"$sort": {"_id": 1}},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()

    out = []
    for row in rows:
        by_type = {b["txn_type"]: b for b in row["buckets"]}

        def total(*types: str) -> int:
            return sum(by_type.get(t, {}).get("total", 0) for t in types)

        def count(*types: str) -> int:
            return sum(by_type.get(t, {}).get("count", 0) for t in types)

        out.append(
            {
                "month": row["_id"],
                # transfers_paise is the part of spending_paise that went
                # to people, not an extra amount on top of it.
                "spending_paise": total(*SPENDING_TYPES),
                "transfers_paise": total(TRANSFER_OUT),
                "received_paise": total(INCOME, TRANSFER_IN, REFUND),
                "self_transfer_paise": total(SELF_TRANSFER),
                "txn_count": count(*SPENDING_TYPES),
                # The same money split by type. expenses + transfers =
                # spending; income + transfers_in + refunds = received.
                "expenses_paise": total(EXPENSE),
                "income_paise": total(INCOME),
                "transfers_in_paise": total(TRANSFER_IN),
                "refunds_paise": total(REFUND),
            }
        )
    return out


async def category_slices(user_id: PydanticObjectId, month: str) -> list[dict]:
    """Spending by category for one month, transfers to people included."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        SPENDING_MATCH,
        {
            "$addFields": {
                "month": {"$dateToString": {"format": "%Y-%m", "date": "$occurred_at"}}
            }
        },
        {"$match": {"month": month}},
        {
            "$group": {
                "_id": {"$ifNull": ["$category", "uncategorised"]},
                "total": {"$sum": "$amount_paise"},
            }
        },
        {"$sort": {"total": -1, "_id": 1}},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    total = sum(r["total"] for r in rows)
    if total == 0:
        return []

    return [
        {
            "name": str(r["_id"]).capitalize(),
            "amount_paise": r["total"],
            "pct": round(100 * r["total"] / total),
        }
        for r in rows
    ]


async def category_trend(user_id: PydanticObjectId) -> list[dict]:
    """Spending per category per month, one row per month:
    {"month": "2026-09", "food": 123400, "mobile": 29900, ...}."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        SPENDING_MATCH,
        {
            "$group": {
                "_id": {
                    "month": {
                        "$dateToString": {"format": "%Y-%m", "date": "$occurred_at"}
                    },
                    "category": {"$ifNull": ["$category", "uncategorised"]},
                },
                "total": {"$sum": "$amount_paise"},
            }
        },
    ]

    rows = await Transaction.aggregate(pipeline).to_list()

    # Every category on every month, zero where nothing was spent — a
    # missing key draws as a gap in the stack, not as zero.
    months = sorted({r["_id"]["month"] for r in rows})
    categories = sorted({r["_id"]["category"] for r in rows})
    out = {m: {"month": m, **{c: 0 for c in categories}} for m in months}
    for r in rows:
        out[r["_id"]["month"]][r["_id"]["category"]] = r["total"]
    return list(out.values())


async def daily_series(user_id: PydanticObjectId) -> list[dict]:
    """Everyday spending per calendar day, oldest first. Days with no
    spending are left out; the heatmap fills them in as empty cells."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        SPENDING_MATCH,
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$occurred_at"}},
                "total": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    return [
        {"date": r["_id"], "amount_paise": r["total"], "count": r["count"]}
        for r in rows
    ]


async def mobile_recharges(user_id: PydanticObjectId) -> list[dict]:
    """How many times each recharge amount was paid, per operator and month.
    Grouped on the exact amount paid, so a plan whose price changed shows
    up as two rows rather than being merged into one."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"txn_type": EXPENSE, "category": "mobile"}},
        {
            "$group": {
                "_id": {
                    "month": {
                        "$dateToString": {"format": "%Y-%m", "date": "$occurred_at"}
                    },
                    "payee": "$counterparty_raw",
                    "amount_paise": "$amount_paise",
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.month": 1, "_id.payee": 1, "_id.amount_paise": 1}},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    return [{**r["_id"], "count": r["count"]} for r in rows]


async def payee_summaries(
    user_id: PydanticObjectId, limit: int = 12, month: str | None = None
) -> list[dict]:
    pipeline: list[dict] = [
        {
            "$match": {"user_id": user_id, "direction": "debit"}
        },
    ]
    if month:
        # Filter before the payee lookup so the join only runs over one month.
        pipeline += [
            {
                "$addFields": {
                    "month": {"$dateToString": {"format": "%Y-%m", "date": "$occurred_at"}}
                }
            },
            {"$match": {"month": month}},
        ]
    pipeline += [
        *_with_category(),
        SPENDING_MATCH,
        {
            "$group": {
                "_id": "$counterparty_raw",
                "category": {"$first": "$category"},
                "total_paise": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1, "total_paise": -1, "_id": 1}},
        {"$limit": limit},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    return [
        {
            "name": r["_id"],
            "count": r["count"],
            "total_paise": r["total_paise"],
            "avg_paise": r["total_paise"] // r["count"],
            "category": r.get("category"),
        }
        for r in rows
    ]


async def clock_buckets(user_id: PydanticObjectId) -> list[dict]:
    """Spending by time of day, counted in payments rather than rupees
    so one large transfer does not dominate a bucket."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        SPENDING_MATCH,
        {
            "$group": {
                "_id": {"$hour": "$occurred_at"},
                "total": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        },
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    by_hour = {r["_id"]: r for r in rows}

    labels = [
        ("Morning 6am–12pm", range(6, 12)),
        ("Afternoon 12–5pm", range(12, 17)),
        ("Evening 5–10pm", range(17, 22)),
        ("Night 10pm–6am", list(range(22, 24)) + list(range(0, 6))),
    ]
    return [
        {
            "bucket": label,
            "count": sum(by_hour.get(h, {}).get("count", 0) for h in hours),
            "amount_paise": sum(by_hour.get(h, {}).get("total", 0) for h in hours),
        }
        for label, hours in labels
    ]


async def people_balances(user_id: PydanticObjectId) -> list[dict]:
    """Net position with each counterparty money moves both ways with.

    A loan that came back is not spending. Without netting, lending
    50,000 and getting it back reads as a 50,000 month.
    """
    pipeline = [
        {"$match": {"user_id": user_id, "is_self_transfer": False}},
        {
            "$group": {
                "_id": "$counterparty_raw",
                "paid": {
                    "$sum": {
                        "$cond": [{"$eq": ["$direction", "debit"]}, "$amount_paise", 0]
                    }
                },
                "paid_count": {
                    "$sum": {"$cond": [{"$eq": ["$direction", "debit"]}, 1, 0]}
                },
                "received": {
                    "$sum": {
                        "$cond": [{"$eq": ["$direction", "credit"]}, "$amount_paise", 0]
                    }
                },
                "received_count": {
                    "$sum": {"$cond": [{"$eq": ["$direction", "credit"]}, 1, 0]}
                },
            }
        },
        # Only people money has moved both ways with. A shop you only
        # pay is not a balance, it is spending.
        {"$match": {"paid_count": {"$gt": 0}, "received_count": {"$gt": 0}}},
        {"$addFields": {"net": {"$subtract": ["$received", "$paid"]}}},
        {"$sort": {"paid": -1, "_id": 1}},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    return [
        {
            "name": r["_id"],
            "paid_paise": r["paid"],
            "paid_count": r["paid_count"],
            "received_paise": r["received"],
            "received_count": r["received_count"],
            "net_paise": r["net"],
            # Under 500 rupees either way is noise, not a debt.
            "settled": abs(r["net"]) < 50_000,
        }
        for r in rows
    ]


async def person_ledger(user_id: PydanticObjectId, name: str) -> list[dict]:
    """Every payment with one person, oldest first, with a running balance."""
    rows = (
        await Transaction.find(
            Transaction.user_id == user_id,
            Transaction.counterparty_raw == name,
            Transaction.is_self_transfer == False,  # noqa: E712
        )
        .sort(Transaction.occurred_at)
        .to_list()
    )

    out = []
    running = 0
    for t in rows:
        running += t.amount_paise if t.direction == "credit" else -t.amount_paise
        out.append(
            {
                "occurred_at": t.occurred_at,
                "direction": t.direction,
                "amount_paise": t.amount_paise,
                "running_paise": running,
            }
        )
    return out
