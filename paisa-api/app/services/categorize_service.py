import logging
from collections import defaultdict

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.db.models import Payee, Transaction
from app.services.llm import complete_json
from app.services.payee_normalize import normalize_name

logger = logging.getLogger("moneytrail")

CATEGORIES = [
    "food", "groceries", "travel", "mobile",
    "health", "shopping", "transfer", "other",
]

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


async def _payee_stats(user_id: PydanticObjectId) -> tuple[dict[str, dict], dict[str, str]]:
    """Both directions. Money coming back is a signal the model needs.

    Grouped by normalised payee, so two spellings of one shop are one
    line in the prompt with their payments added together. Returns the
    stats keyed by a display name (the first spelling seen) and a map
    from that display name to the payee key.
    """
    stats: dict[str, dict] = defaultdict(
        lambda: {
            "count": 0,
            "total": 0,
            "hours": [],
            "received": 0,
            "received_count": 0,
        }
    )
    display: dict[str, str] = {}    # key -> display name
    async for t in Transaction.find(
        Transaction.user_id == user_id,
        Transaction.is_self_transfer == False,  # noqa: E712
    ):
        key = t.payee_key or normalize_name(t.counterparty_raw)
        name = display.setdefault(key, t.counterparty_raw)
        s = stats[name]
        if t.direction == "credit":
            s["received"] += t.amount_paise
            s["received_count"] += 1
        else:
            s["count"] += 1
            s["total"] += t.amount_paise
            s["hours"].append(t.occurred_at.hour)
    return stats, {name: key for key, name in display.items()}


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


async def categorize_all(user_id: PydanticObjectId, only_new: bool = False) -> dict:
    """Categorise payees with the model.

    only_new=True asks only about payees with no category yet, which is
    what an upload needs: the ones already labelled keep their label and
    cost no model calls. The Re-run button passes False to revisit every
    payee the person has not labelled themselves.
    """
    stats, keys = await _payee_stats(user_id)

    # Never re-ask about a payee the person has already labelled.
    existing = await Payee.find(Payee.user_id == user_id).to_list()
    known_keys = {p.normalized_name or normalize_name(p.name) for p in existing}
    decided_keys = {
        p.normalized_name or normalize_name(p.name) for p in existing if p.source == "user"
    }
    skip = known_keys if only_new else decided_keys

    todo = [n for n in stats if keys[n] not in skip]
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

    payees = Payee.get_pymongo_collection()
    for name, category in results.items():
        key = keys[name]
        if key in known_keys:
            # Every spelling of the payee, except ones the person labelled.
            await payees.update_many(
                {"user_id": user_id, "normalized_name": key, "source": {"$ne": "user"}},
                {"$set": {"category": category, "source": "llm"}},
            )
            continue
        try:
            await Payee(
                user_id=user_id, name=name, normalized_name=key,
                category=category, source="llm",
            ).insert()
        except DuplicateKeyError:
            # A concurrent run inserted it first; label it the same way.
            await payees.update_one(
                {"user_id": user_id, "name": name, "source": {"$ne": "user"}},
                {"$set": {"category": category, "source": "llm"}},
            )

    return {
        "payees_seen": len(stats),
        "categorised": len(results),
        "kept_from_user": len(decided_keys),
    }