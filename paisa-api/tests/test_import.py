from datetime import datetime

import pytest
from beanie import PydanticObjectId

from app.core.errors import AppError, Conflict
from app.db.models import Account, Statement, Transaction
from app.services import import_service
from app.services.gpay_parser import ParsedTxn, ParseReport, parse_lines

PDF = b"%PDF-1.4 fake statement A"
PDF_B = b"%PDF-1.4 fake statement B"


def row(txn_id: str, party: str, paise: int, direction: str = "debit") -> ParsedTxn:
    return ParsedTxn(
        txn_id=txn_id,
        occurred_at=datetime(2026, 9, 1, 8, 7),
        direction=direction,
        is_self_transfer=False,
        counterparty_raw=party,
        amount_paise=paise,
        bank="Axis Bank",
        account_last4="1714",
    )


@pytest.fixture
def statement(monkeypatch):
    """Point the importer at whatever rows a test sets, instead of a real PDF."""
    holder = {"report": ParseReport(rows=[], skipped=0)}
    monkeypatch.setattr(import_service, "parse_statement_report", lambda path: holder["report"])
    return holder


def test_parser_counts_lines_it_cannot_read():
    report = parse_lines([
        "01 Apr, 2026 Paid to TEA STALL ₹60",
        "08:07 AM UPI Transaction ID: 609175237501",
        "Paid by Axis Bank 1714",
        "02 Apr, 2026 Received from RAVI ₹1,200.50",
        "something unreadable",
        "03 Apr, 2026 Self transfer to OWN ₹500",
        "09:00 PM UPI Transaction ID: 609175237502",
    ])
    assert [(r.txn_id, r.direction, r.amount_paise, r.is_self_transfer) for r in report.rows] == [
        ("609175237501", "debit", 6_000, False),
        ("609175237502", "debit", 50_000, True),
    ]
    assert report.skipped == 1


async def test_import_links_rows_to_statement_and_account(statement):
    uid = PydanticObjectId()
    statement["report"] = ParseReport(
        rows=[row("1", "Tea Stall", 6_000), row("2", "Ravi", 120_000, "credit")], skipped=1
    )
    s = await import_service.import_statement(uid, "gpay.pdf", PDF)

    assert (s.status, s.rows_inserted, s.rows_failed) == ("completed", 2, 1)
    assert (s.total_debit_paise, s.total_credit_paise) == (6_000, 120_000)
    stored = await Transaction.find(Transaction.user_id == uid).to_list()
    account = await Account.find_one(Account.user_id == uid)
    assert account.name == "Axis Bank ··1714"
    assert {t.statement_id for t in stored} == {s.id}
    assert {t.account_id for t in stored} == {account.id}
    assert {t.payee_key for t in stored} == {"tea stall", "ravi"}


async def test_same_file_twice_is_refused_and_adds_nothing(statement):
    uid = PydanticObjectId()
    statement["report"] = ParseReport(rows=[row("1", "Tea Stall", 6_000)], skipped=0)
    await import_service.import_statement(uid, "gpay.pdf", PDF)
    with pytest.raises(Conflict):
        await import_service.import_statement(uid, "gpay-copy.pdf", PDF)
    assert await Transaction.find(Transaction.user_id == uid).count() == 1
    assert await Statement.find(Statement.user_id == uid).count() == 1


async def test_overlapping_statement_skips_known_rows(statement):
    uid = PydanticObjectId()
    statement["report"] = ParseReport(rows=[row("1", "A", 100), row("2", "B", 200)], skipped=0)
    first = await import_service.import_statement(uid, "aug.pdf", PDF)
    statement["report"] = ParseReport(rows=[row("2", "B", 200), row("3", "C", 300)], skipped=0)
    second = await import_service.import_statement(uid, "sep.pdf", PDF_B)

    assert (second.rows_inserted, second.rows_duplicate) == (1, 1)
    by_id = {t.txn_id: t.statement_id for t in await Transaction.find(Transaction.user_id == uid).to_list()}
    # A row keeps the statement that first brought it in.
    assert by_id == {"1": first.id, "2": first.id, "3": second.id}


async def test_two_users_can_import_the_same_file(statement):
    statement["report"] = ParseReport(rows=[row("1", "A", 100)], skipped=0)
    for uid in (PydanticObjectId(), PydanticObjectId()):
        s = await import_service.import_statement(uid, "gpay.pdf", PDF)
        assert s.rows_inserted == 1


async def test_failed_import_can_be_retried(statement, monkeypatch):
    uid = PydanticObjectId()
    statement["report"] = ParseReport(rows=[row("1", "A", 100)], skipped=0)

    async def boom(docs):
        raise RuntimeError("database went away")

    real = import_service._insert_new_only
    monkeypatch.setattr(import_service, "_insert_new_only", boom)
    with pytest.raises(RuntimeError):
        await import_service.import_statement(uid, "gpay.pdf", PDF)
    failed = await Statement.find_one(Statement.user_id == uid)
    assert (failed.status, failed.file_hash) == ("failed", None)

    monkeypatch.setattr(import_service, "_insert_new_only", real)
    s = await import_service.import_statement(uid, "gpay.pdf", PDF)
    assert (s.status, s.rows_inserted) == ("completed", 1)


@pytest.mark.parametrize(
    ("name", "data", "status"),
    [
        ("notes.txt", PDF, 415),
        ("fake.pdf", b"MZ\x90\x00 not a pdf", 415),
    ],
)
def test_upload_checks(name, data, status):
    with pytest.raises(AppError) as err:
        import_service.check_upload(name, data)
    assert err.value.status_code == status
