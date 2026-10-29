import logging
from collections import defaultdict

from beanie import PydanticObjectId

from app.db.models import Payee, Transaction
from app.services.llm import complete_json

logger = logging.getLogger("paisa")

CATEGORIES = [
    "food", "groceries", "travel", "mobile",
    "health", "shopping", "transfer", "other",
]

MERCHANT_WORDS = {
    "food": ["cafe", "hotel", "mess", "tiffen", "tiffin", "briyani",
             "bakery", "sweet", "juice", "lassi", "cool bar", "chai"],
    "travel": ["motors", "automobiles", "fuels", "petrol", "service station",
               "transport", "metro", "lorry"],
    "groceries": ["store", "supermart", "agencies", "traders", "mart"],
    "health": ["medicals", "clinic", "hospital", "pharmacy"],
    "mobile": ["jio", "airtel", "prepaid"],
}

def by_name(payee: str) -> str | None:
    low = payee.lower()
    for category, words in MERCHANT_WORDS.items():
        if any(w in low for w in words):
            return category
    return None
# Small enough that the model stays accurate, large enough that 164
# payees take a handful of calls rather than 164.
BATCH = 40

PROMPT = """You are categorising payees from an Indian UPI statement.

Many payees are personal names, because small shops in India take payment
through the owner's personal account. The name alone will not tell you
what they are, so judge by the payment pattern.

Amount matters more than anything else:

- many small payments (under Rs 200), mostly mornings -> food, a tea or
  breakfast stall
- many small payments, mostly evenings -> food, an evening snack place
- small payments at mixed times -> food unless something says otherwise
- a few payments averaging over Rs 1000 to a personal name -> transfer
- large round amounts (Rs 5000, Rs 30000) -> transfer

Money coming back only matters when the amounts are large:

- large sums both ways with the same name -> transfer, a person settling up
- small sums both ways -> still a shop. People split small bills with
  shopkeepers. Do not call a Rs 60 payment a transfer because Rs 40 came
  back

A merchant word in the name (mess, cafe, tiffin, hotel, bakery, store,
motors, medicals, clinic, petrol) beats the pattern. Trust it.

Categories, use exactly these words:
{categories}

Payees:
{payees}

Return ONLY JSON in this shape:
{{"payees": [{{"payee": "<name exactly as given>", "category": "<one category>"}}]}}
"""


async def _payee_stats(user_id: PydanticObjectId) -> dict[str, dict]:
    """Both directions. Money coming back is a signal the model needs."""
    stats: dict[str, dict] = defaultdict(
        lambda: {
            "count": 0,
            "total": 0,
            "hours": [],
            "received": 0,
            "received_count": 0,
        }
    )
    async for t in Transaction.find(
        Transaction.user_id == user_id,
        Transaction.is_self_transfer == False,  # noqa: E712
    ):
        s = stats[t.counterparty_raw]
        if t.direction == "credit":
            s["received"] += t.amount_paise
            s["received_count"] += 1
        else:
            s["count"] += 1
            s["total"] += t.amount_paise
            s["hours"].append(t.occurred_at.hour)
    return stats


def _describe(name: str, s: dict) -> str:
    """One prompt line per payee: the name and aggregate figures only.

    UPI references, transaction ids and account numbers stay in Mongo.
    The model has no use for them, and they are the parts of a statement
    that identify the person.
    """
    if s["count"] == 0:
        return f"- {name} | nothing paid out | they sent you Rs {s['received'] // 100}"

    avg = s["total"] // s["count"] // 100
    hours = s["hours"]
    morning = sum(1 for h in hours if 6 <= h < 12)
    evening = sum(1 for h in hours if 17 <= h < 22)
    when = (
        "mornings"
        if morning > len(hours) / 2
        else "evenings"
        if evening > len(hours) / 2
        else "mixed times"
    )

    line = f"- {name} | {s['count']} payments | avg Rs {avg} | {when}"
    if s["received_count"]:
        line += f" | they sent back Rs {s['received'] // 100}"
    return line


async def categorize_all(user_id: PydanticObjectId) -> dict:
    stats = await _payee_stats(user_id)

    # Never re-ask about a payee the person has already labelled.
    existing = await Payee.find(Payee.user_id == user_id).to_list()
    decided = {p.name for p in existing if p.source == "user"}

    todo = [n for n in stats if n not in decided]
    logger.info("categorising %s payees", len(todo))

    results: dict[str, str] = {}
    for i in range(0, len(todo), BATCH):
        chunk = todo[i : i + BATCH]
        prompt = PROMPT.format(
            categories=", ".join(CATEGORIES),
            payees="\n".join(_describe(n, stats[n]) for n in chunk),
        )
        answer = await complete_json(prompt)
        for row in answer.get("payees", []):
            name, category = row.get("payee"), row.get("category")
            # The model can invent a category or alter a name. Drop
            # anything that is not exactly what was asked for.
            if name in stats and category in CATEGORIES:
                results[name] = category
        logger.info("categorised %s/%s", len(results), len(todo))

    for name, category in results.items():
        payee = await Payee.find_one(Payee.user_id == user_id, Payee.name == name)
        if payee is None:
            await Payee(
                user_id=user_id, name=name, category=category, source="llm"
            ).insert()
        elif payee.source != "user":
            payee.category = category
            payee.source = "llm"
            await payee.save()

    return {
        "payees_seen": len(stats),
        "categorised": len(results),
        "kept_from_user": len(decided),
    }