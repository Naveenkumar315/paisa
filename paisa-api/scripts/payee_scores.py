"""Score every payee against the category list, and see the real spread.

Run with:  python -m scripts.payee_scores > docs\payee-scores.txt

Embeddings are cached to disk. A rate-limited run keeps the work it has
already paid for, so a retry starts where the last one stopped.
"""

import asyncio
import json
import math
from collections import defaultdict
from pathlib import Path

from app.db.models import Transaction
from app.db.session import close_db, init_db
from app.services.llm import embed

CACHE = Path("docs/embedding-cache.json")
CHUNK = 25

CATEGORIES = [
    "restaurant, cafe, tea shop, food and drink",
    "groceries, supermarket, provisions store",
    "travel, taxi, metro, fuel, transport",
    "mobile recharge, electricity bill, utilities",
    "clothing, electronics, shopping, retail",
    "doctor, hospital, pharmacy, medical",
]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb)


def load_cache() -> dict[str, list[float]]:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, list[float]]) -> None:
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(cache), encoding="utf-8")


async def embed_cached(texts: list[str]) -> dict[str, list[float]]:
    """Embed only what is not already on disk, saving after every chunk."""
    cache = load_cache()
    missing = [t for t in dict.fromkeys(texts) if t not in cache]

    if not missing:
        print(f"all {len(texts)} already cached", flush=True)
        return cache

    print(f"{len(cache)} cached, {len(missing)} to embed", flush=True)
    try:
        for i in range(0, len(missing), CHUNK):
            chunk = missing[i: i + CHUNK]
            vectors = await embed(chunk)
            cache.update(dict(zip(chunk, vectors)))
            save_cache(cache)
            print(f"  cached {len(cache)}", flush=True)
    finally:
        # Even on a crash, keep what was paid for.
        save_cache(cache)

    return cache


async def main() -> None:
    # Beanie documents are bound to the database, so nothing can be
    # queried until init_beanie has run. A script has to do what the
    # app's lifespan does.
    await init_db()

    counts: dict[str, int] = defaultdict(int)
    async for t in Transaction.find(
        Transaction.direction == "debit",
        Transaction.is_self_transfer == False,  # noqa: E712
    ):
        counts[t.counterparty_raw] += 1

    names = sorted(counts, key=lambda n: -counts[n])
    print(f"{len(names)} payees, {sum(counts.values())} debits", flush=True)

    vectors = await embed_cached(CATEGORIES + names)
    cat_vecs = [vectors[c] for c in CATEGORIES]

    rows = []
    for name in names:
        scores = sorted(
            ((cosine(vectors[name], c), CATEGORIES[i])
             for i, c in enumerate(cat_vecs)),
            reverse=True,
        )
        best, second = scores[0], scores[1]
        rows.append((name, counts[name], best[0],
                    best[0] - second[0], best[1]))

    rows.sort(key=lambda r: -r[3])

    print(f"\n{'payee':46} {'n':>4} {'best':>6} {'gap':>6}  category")
    print("-" * 100)
    for name, n, best, gap, category in rows:
        print(f"{name[:46]:46} {n:4} {best:6.3f} {gap:6.3f}  {category[:30]}")

    gaps = sorted(r[3] for r in rows)
    print("\ngap percentiles")
    for p in (25, 50, 75, 90, 95):
        print(f"  p{p}: {gaps[int(len(gaps) * p / 100)]:.3f}")

    print("\nhow many clear the bar")
    for cut in (0.02, 0.03, 0.04, 0.05, 0.06):
        above = sum(1 for g in gaps if g >= cut)
        share = 100 * above / len(gaps)
        txns = sum(r[1] for r in rows if r[3] >= cut)
        txn_share = 100 * txns / sum(counts.values())
        print(
            f"  gap >= {cut:.2f}: {above:3} payees ({share:4.0f}%)"
            f"  covering {txns:3} payments ({txn_share:4.0f}%)"
        )

    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
