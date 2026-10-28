"""Measure every categorisation approach against the hand-labelled set.

Run with:  python -m scripts.score_approaches

Reports accuracy AND coverage. An approach that answers four payees
perfectly is not better than one that answers thirty-eight at 80%, and
accuracy alone hides that. The majority baseline is printed first because
anything that cannot beat "always guess the commonest category" is not
earning its API calls.
"""

import asyncio
import json
import math
from collections import Counter
from pathlib import Path

from app.services.llm import embed

EVAL = Path("docs/eval-set.json")
CACHE = Path("docs/embedding-cache.json")

# Plain keyword matching. Deterministic, free, instant — and the thing
# every embedding approach has to beat to justify its cost.
KEYWORDS: dict[str, list[str]] = {
    "food": [
        "cafe", "coffee", "hotel", "mess", "tiffen", "tiffin", "briyani",
        "biriyani", "bakery", "sweet", "sweets", "juice", "lassi", "cool bar",
        "fast food", "chai", "tea", "restaurant", "catering", "cake",
        "vilas", "bhavan", "snacks",
    ],
    "groceries": [
        "store", "stores", "supermart", "provision", "provisions", "mart",
        "agencies", "agency", "traders", "blinkit", "grocery", "kirana",
    ],
    "travel": [
        "travels", "transport", "metro", "petrol", "bunk", "fuels", "fuel",
        "service station", "automobiles", "motors", "rapido", "uber", "ola",
        "lorry", "tyres",
    ],
    "mobile": [
        "jio", "airtel", "vodafone", "prepaid", "recharge", "broadband",
        "electricity", "eb bill",
    ],
    "health": [
        "medical", "medicals", "clinic", "hospital", "pharmacy", "pharma",
        "lab", "diagnostics", "dental",
    ],
    "shopping": [
        "clothing", "garments", "readymade", "retail", "flipkart", "amazon",
        "ekart", "textiles", "fashion", "mall",
    ],
}

# Real merchant names, not abstract descriptions. Comparing a name to a
# name works better than comparing a name to a definition.
EXEMPLARS: dict[str, list[str]] = {
    "food": [
        "Saravana Bhavan", "Sri Krishna Mess", "Varsha Tiffin Center",
        "Happy Cafe", "Green Berries Cake Shop", "M S Briyani",
        "Anandha Vilas", "Kolkata Lassi House",
    ],
    "groceries": [
        "Avenue Supermarts", "Vellaiammal store", "Anitha Agencies",
        "Krishnaraj And Co", "Blinkit", "Anubalaji store",
    ],
    "travel": [
        "Sivakumar Petrol Bunk", "T Nagar A J Services Station",
        "CMRL Airport Metro", "Roppen Transportation Services",
        "M/S Devi Motors", "Aswini automobiles",
    ],
    "mobile": [
        "Jio Prepaid", "Airtel recharge", "Tangedco electricity bill",
    ],
    "health": [
        "Super Medicals", "Ellagiri Clinic", "KSK Hospital", "Apollo Pharmacy",
    ],
    "shopping": [
        "Max Retail", "Mathew Garments T Nagar", "Sabura Readymade Stores",
        "Kafa Clothing India", "Flipkart Payments", "Ekart",
    ],
}

# From the earlier description-based run: abstract category text.
DESCRIPTIONS: dict[str, str] = {
    "food": "restaurant, cafe, tea shop, food and drink",
    "groceries": "groceries, supermarket, provisions store",
    "travel": "travel, taxi, metro, fuel, transport",
    "mobile": "mobile recharge, electricity bill, utilities",
    "health": "doctor, hospital, pharmacy, medical",
    "shopping": "clothing, electronics, shopping, retail",
}


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb)


def load_cache() -> dict[str, list[float]]:
    return json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}


def save_cache(cache: dict[str, list[float]]) -> None:
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(cache), encoding="utf-8")


async def vectors_for(texts: list[str]) -> dict[str, list[float]]:
    cache = load_cache()
    missing = [t for t in dict.fromkeys(texts) if t not in cache]
    if missing:
        print(f"embedding {len(missing)} new texts…", flush=True)
        try:
            for i in range(0, len(missing), 25):
                chunk = missing[i: i + 25]
                cache.update(dict(zip(chunk, await embed(chunk))))
                save_cache(cache)
        finally:
            save_cache(cache)
    return cache


def by_keyword(payee: str) -> str | None:
    low = payee.lower()
    for category, words in KEYWORDS.items():
        if any(w in low for w in words):
            return category
    return None


def by_vectors(
    payee: str,
    vecs: dict[str, list[float]],
    anchors: dict[str, list[str]],
    min_gap: float,
) -> str | None:
    """Nearest anchor, but only if it is clearly nearer than the runner-up.

    A high score with no gap means the payee sits the same distance from
    every category — that is not a match, it is noise.
    """
    scored: list[tuple[float, str]] = []
    for category, texts in anchors.items():
        best = max(cosine(vecs[payee], vecs[t]) for t in texts)
        scored.append((best, category))
    scored.sort(reverse=True)
    if len(scored) < 2 or scored[0][0] - scored[1][0] < min_gap:
        return None
    return scored[0][1]


def report(name: str, predictions: dict[str, str | None], truth: dict[str, str]) -> None:
    answered = {p: c for p, c in predictions.items() if c}
    correct = sum(1 for p, c in answered.items() if c == truth[p])
    total = len(truth)

    coverage = 100 * len(answered) / total
    precision = 100 * correct / len(answered) if answered else 0.0
    overall = 100 * correct / total

    print(
        f"{name:34} {overall:5.0f}% overall   "
        f"{precision:5.0f}% when it answers   "
        f"{coverage:5.0f}% coverage"
    )


async def main() -> None:
    data = json.loads(EVAL.read_text(encoding="utf-8"))
    truth = {
        row["payee"]: row["category"]
        for row in data["payees"]
        if row.get("category")
    }
    payees = list(truth)
    print(f"{len(payees)} labelled payees\n")

    counts = Counter(truth.values())
    print("label distribution")
    for category, n in counts.most_common():
        print(f"  {category:12} {n:3}  ({100 * n / len(truth):3.0f}%)")

    majority, majority_n = counts.most_common(1)[0]
    print(
        f"\nmajority baseline: always say \"{majority}\" "
        f"-> {100 * majority_n / len(truth):.0f}%\n"
    )

    anchor_texts = [t for texts in EXEMPLARS.values() for t in texts]
    anchor_texts += list(DESCRIPTIONS.values())
    vecs = await vectors_for(payees + anchor_texts)

    desc_anchors = {k: [v] for k, v in DESCRIPTIONS.items()}

    print(f"{'approach':34} {'overall':>7}   {'precision':>9}   {'coverage':>8}")
    print("-" * 78)

    report(
        "always majority",
        {p: majority for p in payees},
        truth,
    )
    report(
        "keywords only",
        {p: by_keyword(p) for p in payees},
        truth,
    )

    for gap in (0.01, 0.03, 0.05):
        report(
            f"embeddings vs descriptions g={gap}",
            {p: by_vectors(p, vecs, desc_anchors, gap) for p in payees},
            truth,
        )

    for gap in (0.01, 0.03, 0.05):
        report(
            f"embeddings vs exemplars g={gap}",
            {p: by_vectors(p, vecs, EXEMPLARS, gap) for p in payees},
            truth,
        )

    for gap in (0.01, 0.03):
        report(
            f"keywords, then exemplars g={gap}",
            {
                p: by_keyword(p) or by_vectors(p, vecs, EXEMPLARS, gap)
                for p in payees
            },
            truth,
        )

    print("\nwhere keywords get it wrong")
    for p in payees:
        guess = by_keyword(p)
        if guess and guess != truth[p]:
            print(f"  {p[:40]:40} said {guess:10} actually {truth[p]}")

    print("\nwhat keywords cannot reach")
    unreached = [p for p in payees if by_keyword(p) is None]
    print(
        f"  {len(unreached)} payees: {', '.join(p[:24] for p in unreached[:10])}")
    if len(unreached) > 10:
        print(f"  and {len(unreached) - 10} more")


if __name__ == "__main__":
    asyncio.run(main())
