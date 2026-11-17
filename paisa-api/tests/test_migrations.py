from datetime import datetime

from beanie import PydanticObjectId

from app.db.migrations import m001_payee_keys, run_pending
from app.db.models import Account, Payee, Transaction


async def insert_old_shape(uid: PydanticObjectId) -> None:
    """Documents as they were stored before Sprint 1: no keys, no account."""
    await Transaction.get_pymongo_collection().insert_many([
        {"user_id": uid, "txn_id": "1", "occurred_at": datetime(2026, 9, 1),
         "direction": "debit", "is_self_transfer": False, "counterparty_raw": "TEA STALL",
         "amount_paise": 6_000, "bank": "Axis Bank", "account_last4": "1714"},
        {"user_id": uid, "txn_id": "2", "occurred_at": datetime(2026, 9, 2),
         "direction": "debit", "is_self_transfer": False, "counterparty_raw": "Tea Stall",
         "amount_paise": 4_000, "bank": "Indian Bank", "account_last4": "0042"},
    ])
    await Payee.get_pymongo_collection().insert_one(
        {"user_id": uid, "name": "Tea Stall", "category": "food", "source": "llm"}
    )


async def test_backfill_and_idempotence():
    uid = PydanticObjectId()
    await insert_old_shape(uid)

    dry = await run_pending(dry_run=True)
    assert dry["001_payee_keys"] == {"payees_set": 1, "transactions_set": 2}
    assert await Transaction.find(Transaction.payee_key == None).count() == 2  # noqa: E711

    applied = await run_pending()
    assert set(applied) == {"001_payee_keys", "002_accounts"}
    txns = await Transaction.find(Transaction.user_id == uid).to_list()
    assert {t.payee_key for t in txns} == {"tea stall"}
    assert len({t.account_id for t in txns}) == 2
    assert await Account.find(Account.user_id == uid).count() == 2

    # Recorded, so not run again; and harmless if it were.
    assert await run_pending() == {}
    assert await m001_payee_keys.run(False) == {"payees_set": 0, "transactions_set": 0}
