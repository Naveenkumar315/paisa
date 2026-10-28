"""Why personal names cannot be categorised from the name alone."""

import asyncio
import math

from app.services.llm import embed


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb)


CATEGORIES = [
    "restaurant, cafe, tea shop, food and drink",
    "groceries, supermarket, provisions store",
    "travel, taxi, metro, fuel, transport",
    "mobile recharge, electricity bill, utilities",
    "clothing, electronics, shopping, retail",
]

PAYEES = [
    # Merchants — the name says what they are.
    "AVENUE SUPERMARTS LTD",
    "ROPPEN TRANSPORTATION SERVICES PRIVATE LIMITED",
    "Jio Prepaid",
    "HAPPY CAFE",
    "CMRL AIRPORT METRO TOM 11",
    # Personal names — the name says nothing.
    "RAMACHANDRAN V",
    "BENAZEER BEGUM",
    "Umarani",
    "MR MAHMOOD MUSTHAAQ N H",
    "GADDAM HARIBABU REDDY",
]


async def main() -> None:
    vectors = await embed(CATEGORIES + PAYEES)
    cat_vecs = vectors[: len(CATEGORIES)]
    pay_vecs = vectors[len(CATEGORIES):]

    print(f"{'payee':50} {'best':>6} {'gap':>6}  category")
    print("-" * 100)

    for name, vec in zip(PAYEES, pay_vecs):
        scores = sorted(
            ((cosine(vec, c), CATEGORIES[i]) for i, c in enumerate(cat_vecs)),
            reverse=True,
        )
        best, second = scores[0], scores[1]
        gap = best[0] - second[0]
        print(f"{name:50} {best[0]:6.3f} {gap:6.3f}  {best[1][:34]}")


if __name__ == "__main__":
    asyncio.run(main())
