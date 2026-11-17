"""What each transaction is. The one place that decides.

Every total on every screen, and every number the Ask agent quotes, runs
through classify_stages(). Before this, the dashboard and the tools each
carried their own idea of what counts as spending, and two definitions of
one number drift apart.

The decision, in order:

1. The person's own override on the transaction wins.
2. A "Self transfer to" line is a self-transfer. It is never spending.
3. Credits: from a payee labelled transfer -> transfer_in (a person
   paying you back); from a payee with a shop category -> refund (a shop
   handing money back); anything else -> income.
4. Debits: to a payee labelled transfer -> transfer_out. An unlabelled
   debit of Rs 2,000 or more is assumed to be a transfer too. Everything
   else -> expense.

Category is the transaction's own override if it has one, otherwise the
payee's.

The old buckets are derived from the type, so every existing number stays
what it was: spending = expense + transfer_out, received = every credit
type, self = self_transfer.
"""

EXPENSE = "expense"
TRANSFER_OUT = "transfer_out"
SELF_TRANSFER = "self_transfer"
INCOME = "income"
TRANSFER_IN = "transfer_in"
REFUND = "refund"

DEBIT_TYPES = [EXPENSE, TRANSFER_OUT, SELF_TRANSFER]
CREDIT_TYPES = [INCOME, TRANSFER_IN, REFUND, SELF_TRANSFER]
ALL_TYPES = [EXPENSE, TRANSFER_OUT, SELF_TRANSFER, INCOME, TRANSFER_IN, REFUND]

# "transfer" and "other" say nothing about whether the payee is a shop.
MERCHANT_CATEGORIES = ["food", "groceries", "travel", "mobile", "health", "shopping"]

# Fallback only. A large debit to a payee nobody has labelled is almost
# certainly a transfer, but once the payee has a category that wins.
TRANSFER_MIN_PAISE = 200_000

# Money sent to people counts as spending, as it always has; transfer_out
# stays its own type so it can be shown separately.
SPENDING_TYPES = [EXPENSE, TRANSFER_OUT]
SPENDING_MATCH = {"$match": {"txn_type": {"$in": SPENDING_TYPES}}}

_BUCKET = {
    EXPENSE: "spending",
    TRANSFER_OUT: "transfer",
    SELF_TRANSFER: "self",
    INCOME: "received",
    TRANSFER_IN: "received",
    REFUND: "received",
}


def allowed_types(direction: str) -> list[str]:
    return CREDIT_TYPES if direction == "credit" else DEBIT_TYPES


def _is_set(field: str) -> dict:
    """True when a field holds a value; false when null or absent."""
    return {"$ne": [{"$ifNull": [field, None]}, None]}


def classify_stages() -> list[dict]:
    """Pipeline stages that add `category`, `category_source`, `txn_type`
    and `bucket` to each transaction.

    The payee join happens in the database, on the normalised payee key.
    If two spellings of a payee exist, the one the person labelled wins.
    """
    return [
        {
            "$lookup": {
                "from": "payees",
                "let": {"key": "$payee_key", "uid": "$user_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {
                                "$and": [
                                    {"$eq": ["$user_id", "$$uid"]},
                                    {"$eq": ["$normalized_name", "$$key"]},
                                ]
                            }
                        }
                    },
                    # "user" sorts after "llm", so descending puts the
                    # person's own label first.
                    {"$sort": {"source": -1}},
                    {"$limit": 1},
                    {"$project": {"category": 1, "_id": 0}},
                ],
                "as": "payee_doc",
            }
        },
        {
            "$addFields": {
                "payee_category": {"$first": "$payee_doc.category"},
            }
        },
        {
            "$addFields": {
                "category": {
                    "$cond": [
                        _is_set("$category_override"),
                        "$category_override",
                        {"$ifNull": ["$payee_category", None]},
                    ]
                },
                "category_source": {
                    "$cond": [
                        _is_set("$category_override"),
                        "override",
                        {"$cond": [_is_set("$payee_category"), "payee", None]},
                    ]
                },
            }
        },
        {
            "$addFields": {
                "txn_type": {
                    "$switch": {
                        "branches": [
                            {"case": _is_set("$type_override"), "then": "$type_override"},
                            {"case": {"$eq": ["$is_self_transfer", True]}, "then": SELF_TRANSFER},
                            {
                                "case": {"$eq": ["$direction", "credit"]},
                                "then": {
                                    "$switch": {
                                        "branches": [
                                            {
                                                "case": {"$eq": ["$category", "transfer"]},
                                                "then": TRANSFER_IN,
                                            },
                                            {
                                                "case": {"$in": ["$category", MERCHANT_CATEGORIES]},
                                                "then": REFUND,
                                            },
                                        ],
                                        "default": INCOME,
                                    }
                                },
                            },
                            # A labelled transfer is a transfer whatever the
                            # amount: lending 500 rupees is not lunch.
                            {"case": {"$eq": ["$category", "transfer"]}, "then": TRANSFER_OUT},
                            # Unlabelled and large: assume transfer.
                            {
                                "case": {
                                    "$and": [
                                        {"$not": [_is_set("$category")]},
                                        {"$gte": ["$amount_paise", TRANSFER_MIN_PAISE]},
                                    ]
                                },
                                "then": TRANSFER_OUT,
                            },
                        ],
                        "default": EXPENSE,
                    }
                }
            }
        },
        {
            "$addFields": {
                "bucket": {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$txn_type", t]}, "then": b}
                            for t, b in _BUCKET.items()
                        ],
                        "default": "spending",
                    }
                }
            }
        },
        {"$project": {"payee_doc": 0, "payee_category": 0}},
    ]
