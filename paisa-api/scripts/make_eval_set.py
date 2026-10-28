"""Export the top payees as a labelling template.

Run with:  python -m scripts.make_eval_set

Writes docs/eval-set.json with "category" left blank on every row. Fill
them in by hand — that file becomes the answer key every categorisation
approach is measured against.

Each row carries hints (how often, how much, what time) because a name
like "RAMACHANDRAN V" tells you nothing on its own, but "19 payments,
average 51 rupees, usually 8-9am" tells you it is the tea shop.
"""

import asyncio
import json
from collections import defaultdict
from pathlib import Path

from app.db.models import Transaction
from app.db.session import close_db, init_db

OUT = Path("docs/eval-set.json")
TOP_N = 40

CATEGORIES = [
    "food",        # tea, meals, cafes, tiffin, bakery
    "groceries",   # provisions, supermarket, daily needs
    "travel",      # metro, auto, petrol, vehicle service
    "mobile",      # recharge, bills, utilities
    "health",      # clinic, pharmacy, hospital
    "shopping",    # clothes, electronics, online orders
    "transfer",    # money to a person, not a purchase
    "other",       # anything that fits nowhere
]


def time_hint(hours: list[int]) -> str:
    """Describe when the payments happen, to jog your memory."""
    if not hours:
        return ""
    buckets = defaultdict(int)
    for h in hours:
        if 6 <= h < 12:
            buckets["morning"] += 1
        elif 12 <= h < 17:
            buckets["afternoon"] += 1
        elif 17 <= h < 22:
            buckets["evening"] += 1
        else:
            buckets["late night"] += 1
    top, n = max(buckets.items(), key=lambda kv: kv[1])
    share = round(100 * n / len(hours))
    return f"mostly {top} ({share}%)"


async def main() -> None:
    await init_db()

    stats: dict[str, dict] = defaultdict(
        lambda: {"count": 0, "total": 0, "hours": [], "days": set()}
    )

    async for t in Transaction.find(
        Transaction.direction == "debit",
        Transaction.is_self_transfer == False,  # noqa: E712
    ):
        s = stats[t.counterparty_raw]
        s["count"] += 1
        s["total"] += t.amount_paise
        s["hours"].append(t.occurred_at.hour)
        s["days"].add(t.occurred_at.date().isoformat())

    # Most frequent first: labelling these covers the most payments.
    names = sorted(stats, key=lambda n: -stats[n]["count"])[:TOP_N]

    rows = []
    for name in names:
        s = stats[name]
        rows.append(
            {
                "payee": name,
                "category": "",  # <- fill this in
                "hint": {
                    "payments": s["count"],
                    "total_rupees": round(s["total"] / 100),
                    "average_rupees": round(s["total"] / s["count"] / 100),
                    "distinct_days": len(s["days"]),
                    "when": time_hint(s["hours"]),
                },
            }
        )

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(
        json.dumps({"categories": CATEGORIES, "payees": rows},
                   indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    covered = sum(r["hint"]["payments"] for r in rows)
    total = sum(s["count"] for s in stats.values())
    print(f"wrote {OUT} — {len(rows)} payees")
    print(
        f"they cover {covered} of {total} payments ({100 * covered / total:.0f}%)")
    print(f"\nvalid categories: {', '.join(CATEGORIES)}")
    print("\nFill in every \"category\" field, then run scripts.score_approaches")

    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
