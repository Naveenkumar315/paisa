from beanie import PydanticObjectId

from app.db.models import Transaction

# Fallback only. A large debit to a payee nobody has labelled is almost
# certainly a transfer, but once the payee has a category that wins.
TRANSFER_MIN_PAISE = 200_000


def _with_category() -> list[dict]:
    """Attach each transaction's payee category, then bucket it.

    The join happens in the database. Pulling four hundred transactions
    into Python to look up a category each would be four hundred round
    trips for six numbers.
    """
    return [
        {
            "$lookup": {
                "from": "payees",
                "let": {"payee": "$counterparty_raw", "uid": "$user_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$name", "$$payee"]},
                                    {"$eq": ["$user_id", "$$uid"]},
                                ]
                            }
                        }
                    },
                    {"$project": {"category": 1, "_id": 0}},
                ],
                "as": "payee_doc",
            }
        },
        {
            "$addFields": {
                "category": {"$first": "$payee_doc.category"},
            }
        },
        {
            "$addFields": {
                "bucket": {
                    "$switch": {
                        "branches": [
                            {"case": "$is_self_transfer", "then": "self"},
                            {
                                "case": {"$eq": ["$direction", "credit"]},
                                "then": "received",
                            },
                            # A labelled transfer is a transfer whatever
                            # the amount: lending 500 rupees is not lunch.
                            {
                                "case": {"$eq": ["$category", "transfer"]},
                                "then": "transfer",
                            },
                            # Unlabelled and large: assume transfer.
                            {
                                "case": {
                                    "$and": [
                                        {"$eq": [
                                            {"$type": "$category"}, "missing"]},
                                        {"$gte": ["$amount_paise",
                                                  TRANSFER_MIN_PAISE]},
                                    ]
                                },
                                "then": "transfer",
                            },
                        ],
                        "default": "spending",
                    }
                }
            }
        },
    ]


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
                    "bucket": "$bucket",
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
                        "bucket": "$_id.bucket",
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
        totals = {b["bucket"]: b for b in row["buckets"]}
        spending = totals.get("spending", {})
        transfer = totals.get("transfer", {})
        out.append(
            {
                "month": row["_id"],
                "spending_paise": spending.get("total", 0),
                "transfers_paise": transfer.get("total", 0),
                "received_paise": totals.get("received", {}).get("total", 0),
                "self_transfer_paise": totals.get("self", {}).get("total", 0),
                "txn_count": spending.get("count", 0) + transfer.get("count", 0),
            }
        )
    return out


async def category_slices(user_id: PydanticObjectId, month: str) -> list[dict]:
    """Spending by category for one month. Transfers are not spending."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending"}},
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
        {"$sort": {"total": -1}},
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
        {"$match": {"bucket": "spending"}},
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


async def mobile_recharges(user_id: PydanticObjectId) -> list[dict]:
    """How many times each recharge amount was paid, per operator and month.
    Grouped on the exact amount paid, so a plan whose price changed shows
    up as two rows rather than being merged into one."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending", "category": "mobile"}},
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
            "$match": {
                "user_id": user_id,
                "direction": "debit",
                "is_self_transfer": False,
            }
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
        {
            "$group": {
                "_id": "$counterparty_raw",
                "category": {"$first": "$category"},
                "total_paise": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1, "total_paise": -1}},
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
    """Spending by time of day. Everyday payments only — one large
    transfer at 3am would otherwise own the night bucket."""
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending"}},
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
        {"$sort": {"paid": -1}},
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
