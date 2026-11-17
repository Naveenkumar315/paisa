"""The classification rules, pinned with exact numbers.

If one of these changes, a number on the dashboard changed. That may be
intended, but it should never be a surprise.
"""

from datetime import datetime

from beanie import PydanticObjectId

from app.services import analytics_service as analytics
from app.services import transactions_service as txns
from app.services.transactions_service import TxnFilter
from tests.conftest import add_payee, add_txn

MONTH = "2026-09"


async def seed(uid: PydanticObjectId) -> dict:
    await add_payee(uid, "Tea Stall", "food")
    await add_payee(uid, "Ravi Kumar", "transfer")
    await add_payee(uid, "Big Store", "groceries")
    return {
        "tea": await add_txn(uid, "Tea Stall", 6_000),
        "tea_caps": await add_txn(uid, "TEA  STALL", 4_000),          # same payee, other spelling
        "lend": await add_txn(uid, "Ravi Kumar", 50_000),
        "repaid": await add_txn(uid, "Ravi Kumar", 20_000, "credit"),
        "refund": await add_txn(uid, "Big Store", 1_500, "credit"),
        "salary": await add_txn(uid, "Employer Ltd", 100_000, "credit"),
        "big_unknown": await add_txn(uid, "Unknown Person", 300_000),  # >= Rs 2,000, unlabelled
        "small_unknown": await add_txn(uid, "Unknown Shop", 15_000),
        "self": await add_txn(uid, "Own Account", 1_000_000, is_self_transfer=True),
    }


async def month(uid):
    rows = await analytics.monthly_summaries(uid)
    return next(m for m in rows if m["month"] == MONTH)


async def types_by_party(uid) -> dict[int, str]:
    page = await txns.list_transactions(uid, TxnFilter(), limit=200)
    return {t["amount_paise"]: t["txn_type"] for t in page["items"]}


async def test_each_rule():
    uid = PydanticObjectId()
    await seed(uid)
    assert await types_by_party(uid) == {
        6_000: "expense",
        4_000: "expense",
        50_000: "transfer_out",
        20_000: "transfer_in",
        1_500: "refund",
        100_000: "income",
        300_000: "transfer_out",
        15_000: "expense",
        1_000_000: "self_transfer",
    }


async def test_month_totals():
    uid = PydanticObjectId()
    await seed(uid)
    m = await month(uid)
    assert m == {
        "month": MONTH,
        # Unchanged meaning: spending includes money sent to people.
        "spending_paise": 25_000 + 350_000,
        "transfers_paise": 350_000,
        "received_paise": 121_500,
        "self_transfer_paise": 1_000_000,
        "txn_count": 5,
        "expenses_paise": 25_000,
        "income_paise": 100_000,
        "transfers_in_paise": 20_000,
        "refunds_paise": 1_500,
    }


async def test_spellings_share_a_category():
    uid = PydanticObjectId()
    await seed(uid)
    slices = {s["name"]: s["amount_paise"] for s in await analytics.category_slices(uid, MONTH)}
    assert slices == {"Uncategorised": 315_000, "Transfer": 50_000, "Food": 10_000}


async def test_persons_label_beats_the_models():
    uid = PydanticObjectId()
    await seed(uid)
    await add_payee(uid, "TEA  STALL", "health", source="user")
    slices = {s["name"]: s["amount_paise"] for s in await analytics.category_slices(uid, MONTH)}
    assert slices["Health"] == 10_000
    assert "Food" not in slices


async def test_overrides_win():
    uid = PydanticObjectId()
    t = await seed(uid)
    await txns.update_transaction(uid, t["big_unknown"].id, {"type_override": "expense"})
    await txns.update_transaction(uid, t["small_unknown"].id, {"category_override": "shopping"})
    m = await month(uid)
    assert m["expenses_paise"] == 325_000
    assert m["transfers_paise"] == 50_000
    assert m["spending_paise"] == 375_000       # moved between types, not added
    slices = {s["name"]: s["amount_paise"] for s in await analytics.category_slices(uid, MONTH)}
    assert slices["Shopping"] == 15_000


async def test_other_months_are_separate():
    uid = PydanticObjectId()
    await add_txn(uid, "Tea Stall", 1_000, when=datetime(2026, 8, 31, 23, 59))
    await add_txn(uid, "Tea Stall", 2_000, when=datetime(2026, 9, 1, 0, 0))
    months = {m["month"]: m["spending_paise"] for m in await analytics.monthly_summaries(uid)}
    assert months == {"2026-08": 1_000, "2026-09": 2_000}
