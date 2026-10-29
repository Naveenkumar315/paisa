"""The tools the agent can call.

Each tool is two things: a schema the model reads to decide what to call,
and a handler that answers it from the database. Every number in an
answer comes from a handler, never from the model's own arithmetic.
"""

import re
import logging
from typing import Any, Awaitable, Callable

from beanie import PydanticObjectId

from app.db.models import Transaction
from app.services.analytics_service import _with_category
from app.services.categorize_service import CATEGORIES

logger = logging.getLogger("paisa")

MONTH_PATTERN = r"^\d{4}-\d{2}$"


MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def _check_month(value: str, field: str = "month") -> None:
    """Reject a malformed month loudly.

    An unparseable month must not silently match nothing. "September"
    returning zero reads to the model as a real answer, and it will tell
    the user they spent nothing that month.
    """
    if not MONTH_RE.match(value):
        raise ValueError(
            f"{field} must be YYYY-MM, for example 2026-09. Got: {value!r}"
        )


# ---------------------------------------------------------------- schemas

TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_spending",
            "description": (
                "Total everyday spending for one month, optionally for one "
                "category. Excludes transfers to people and movements between "
                "the user's own accounts."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {
                        "type": "string",
                        "pattern": MONTH_PATTERN,
                        "description": "Month as YYYY-MM, for example 2026-09",
                    },
                    "category": {
                        "type": "string",
                        "enum": CATEGORIES,
                        "description": "Omit for all categories",
                    },
                },
                "required": ["month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payee_total",
            "description": (
                "Everything paid to one payee: total, number of payments and "
                "average. Matches on part of the name, case-insensitively, so "
                "'jio' finds 'Jio Prepaid'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Part of the payee name"},
                    "month": {
                        "type": "string",
                        "pattern": MONTH_PATTERN,
                        "description": "Omit for all months",
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_months",
            "description": (
                "Spending in two months side by side, broken down by category, "
                "so the difference can be explained rather than just stated."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "month_a": {"type": "string", "pattern": MONTH_PATTERN},
                    "month_b": {"type": "string", "pattern": MONTH_PATTERN},
                },
                "required": ["month_a", "month_b"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "top_payees",
            "description": "The payees with the highest spending, for one month or overall.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {
                        "type": "string",
                        "pattern": MONTH_PATTERN,
                        "description": "Omit for all months",
                    },
                    "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_payments",
            "description": (
                "Payments whose amount falls in a rupee range, counted per "
                "month, payee and exact amount. Use it whenever the question "
                "names an amount or a plan price. When the user is unsure of "
                "the exact figure ('49 or 50', 'around 300'), search a small "
                "range around it rather than one value."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "min_rupees": {"type": "number", "minimum": 0},
                    "max_rupees": {"type": "number", "minimum": 0},
                    "name": {
                        "type": "string",
                        "description": "Part of the payee name. Omit for every payee",
                    },
                    "month": {
                        "type": "string",
                        "pattern": MONTH_PATTERN,
                        "description": "Omit for all months",
                    },
                },
                "required": ["min_rupees", "max_rupees"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_months",
            "description": (
                "Which months the statement covers, with each month's total. "
                "Call this first when the user says 'last month' or 'recently' "
                "and the period is not otherwise known."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


# --------------------------------------------------------------- handlers


def _month_field() -> dict:
    return {
        "$addFields": {
            "month": {"$dateToString": {"format": "%Y-%m", "date": "$occurred_at"}}
        }
    }


def _rupees(paise: int) -> str:
    return f"{paise / 100:,.2f}"


async def get_spending(
    user_id: PydanticObjectId, month: str, category: str | None = None
) -> dict:
    _check_month(month)
    pipeline: list[dict] = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending"}},
        _month_field(),
        {"$match": {"month": month}},
    ]
    if category:
        pipeline.append({"$match": {"category": category}})
    pipeline.append(
        {"$group": {"_id": None, "total": {"$sum": "$amount_paise"}, "count": {"$sum": 1}}}
    )

    rows = await Transaction.aggregate(pipeline).to_list()
    if not rows:
        return {"month": month, "category": category, "total_rupees": "0.00", "payments": 0}

    return {
        "month": month,
        "category": category or "all",
        "total_rupees": _rupees(rows[0]["total"]),
        "payments": rows[0]["count"],
    }


async def get_payee_total(
    user_id: PydanticObjectId, name: str, month: str | None = None
) -> dict:
    if month:
        _check_month(month)
    pipeline: list[dict] = [
        {
            "$match": {
                "user_id": user_id,
                "direction": "debit",
                "is_self_transfer": False,
                # The user types "jio", the statement says "Jio Prepaid".
                # Anchoring on an exact name would answer "nothing found"
                # to a question that has an obvious answer.
                "counterparty_raw": {"$regex": name, "$options": "i"},
            }
        },
    ]
    if month:
        pipeline += [_month_field(), {"$match": {"month": month}}]
    pipeline.append(
        {
            "$group": {
                "_id": "$counterparty_raw",
                "total": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        }
    )
    pipeline.append({"$sort": {"total": -1}})

    rows = await Transaction.aggregate(pipeline).to_list()
    if not rows:
        return {"query": name, "matched": [], "note": "No payee matched that name"}

    return {
        "query": name,
        "month": month or "all months",
        "matched": [
            {
                "payee": r["_id"],
                "total_rupees": _rupees(r["total"]),
                "payments": r["count"],
                "average_rupees": _rupees(r["total"] // r["count"]),
            }
            for r in rows
        ],
    }


async def compare_months(
    user_id: PydanticObjectId, month_a: str, month_b: str
) -> dict:
    _check_month(month_a, "month_a")
    _check_month(month_b, "month_b")
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending"}},
        _month_field(),
        {"$match": {"month": {"$in": [month_a, month_b]}}},
        {
            "$group": {
                "_id": {"month": "$month", "category": "$category"},
                "total": {"$sum": "$amount_paise"},
            }
        },
    ]

    rows = await Transaction.aggregate(pipeline).to_list()

    out: dict[str, dict[str, str]] = {month_a: {}, month_b: {}}
    totals = {month_a: 0, month_b: 0}
    for r in rows:
        m = r["_id"]["month"]
        c = r["_id"].get("category") or "uncategorised"
        out[m][c] = _rupees(r["total"])
        totals[m] += r["total"]

    return {
        "months": {
            month_a: {"total_rupees": _rupees(totals[month_a]), "by_category": out[month_a]},
            month_b: {"total_rupees": _rupees(totals[month_b]), "by_category": out[month_b]},
        },
        "difference_rupees": _rupees(totals[month_b] - totals[month_a]),
    }


async def top_payees(
    user_id: PydanticObjectId, month: str | None = None, limit: int = 5
) -> dict:
    if month:
        _check_month(month)
    pipeline: list[dict] = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending"}},
    ]
    if month:
        pipeline += [_month_field(), {"$match": {"month": month}}]
    pipeline += [
        {
            "$group": {
                "_id": "$counterparty_raw",
                "category": {"$first": "$category"},
                "total": {"$sum": "$amount_paise"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"total": -1}},
        {"$limit": min(limit, 20)},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    return {
        "month": month or "all months",
        "payees": [
            {
                "payee": r["_id"],
                "category": r.get("category"),
                "total_rupees": _rupees(r["total"]),
                "payments": r["count"],
            }
            for r in rows
        ],
    }


# A wide range over six months can match hundreds of groups. The model
# only needs the shape of the answer, and the totals cover everything.
FIND_PAYMENTS_MAX_ROWS = 40


async def find_payments(
    user_id: PydanticObjectId,
    min_rupees: float,
    max_rupees: float,
    name: str | None = None,
    month: str | None = None,
) -> dict:
    if month:
        _check_month(month)
    if min_rupees > max_rupees:
        raise ValueError("min_rupees must not be greater than max_rupees")

    match: dict = {
        "user_id": user_id,
        "direction": "debit",
        "is_self_transfer": False,
        "amount_paise": {
            "$gte": round(min_rupees * 100),
            "$lte": round(max_rupees * 100),
        },
    }
    if name:
        match["counterparty_raw"] = {"$regex": re.escape(name), "$options": "i"}

    pipeline: list[dict] = [{"$match": match}, _month_field()]
    if month:
        pipeline.append({"$match": {"month": month}})
    pipeline += [
        {
            "$group": {
                "_id": {
                    "month": "$month",
                    "payee": "$counterparty_raw",
                    "amount": "$amount_paise",
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.month": 1, "_id.payee": 1, "_id.amount": 1}},
    ]

    rows = await Transaction.aggregate(pipeline).to_list()
    if not rows:
        return {
            "range_rupees": [min_rupees, max_rupees],
            "payments": 0,
            "note": "No payment in that range",
        }

    total_count = sum(r["count"] for r in rows)
    total_paise = sum(r["_id"]["amount"] * r["count"] for r in rows)
    by_payee: dict[str, int] = {}
    for r in rows:
        by_payee[r["_id"]["payee"]] = by_payee.get(r["_id"]["payee"], 0) + r["count"]

    return {
        "range_rupees": [min_rupees, max_rupees],
        "payee_filter": name,
        "month": month or "all months",
        "payments": total_count,
        "total_rupees": _rupees(total_paise),
        "payments_by_payee": by_payee,
        "groups": [
            {
                "month": r["_id"]["month"],
                "payee": r["_id"]["payee"],
                "amount_rupees": _rupees(r["_id"]["amount"]),
                "times": r["count"],
            }
            for r in rows[:FIND_PAYMENTS_MAX_ROWS]
        ],
        "groups_truncated": len(rows) > FIND_PAYMENTS_MAX_ROWS,
    }


async def list_months(user_id: PydanticObjectId) -> dict:
    pipeline = [
        {"$match": {"user_id": user_id}},
        *_with_category(),
        {"$match": {"bucket": "spending"}},
        _month_field(),
        {"$group": {"_id": "$month", "total": {"$sum": "$amount_paise"}}},
        {"$sort": {"_id": 1}},
    ]
    rows = await Transaction.aggregate(pipeline).to_list()
    return {
        "months": [
            {"month": r["_id"], "spending_rupees": _rupees(r["total"])} for r in rows
        ]
    }


# ------------------------------------------------------------- dispatch

HANDLERS: dict[str, Callable[..., Awaitable[dict]]] = {
    "get_spending": get_spending,
    "get_payee_total": get_payee_total,
    "compare_months": compare_months,
    "top_payees": top_payees,
    "find_payments": find_payments,
    "list_months": list_months,
}


async def run_tool(
    user_id: PydanticObjectId, name: str, arguments: dict[str, Any]
) -> dict:
    """Call one tool by name.

    Returns an error dict rather than raising, because a bad tool call is
    something the model should see and correct on the next step, not
    something that kills the whole request.
    """
    handler = HANDLERS.get(name)
    if handler is None:
        return {"error": f"No tool called {name}. Available: {', '.join(HANDLERS)}"}

    try:
        return await handler(user_id, **arguments)
    except (TypeError, ValueError) as exc:
        # Wrong or missing arguments. The message names them, so the
        # model can fix its own call.
        return {"error": f"Bad arguments for {name}: {exc}"}
    except Exception as exc:
        logger.exception("tool_failed name=%s", name)
        return {"error": f"{name} failed: {exc}"}
