import hashlib
import logging
import os
import tempfile

from beanie import PydanticObjectId
from pymongo.errors import BulkWriteError, DuplicateKeyError

from app.core.config import settings
from app.core.errors import AppError, Conflict
from app.db.models import Statement, Transaction
from app.services import accounts_service
from app.services.gpay_parser import ParseReport, parse_statement_report
from app.services.payee_normalize import normalize_name

logger = logging.getLogger("moneytrail")

DUPLICATE_KEY = 11000

PDF_MAGIC = b"%PDF-"


def check_upload(filename: str, data: bytes) -> None:
    if not filename.lower().endswith(".pdf"):
        raise AppError("Only PDF statements are supported", status_code=415)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise AppError(
            f"File is over {settings.max_upload_mb}MB", status_code=413)
    # The name says .pdf; the bytes have to agree before a PDF parser
    # is pointed at them.
    if not data.startswith(PDF_MAGIC):
        raise AppError("That file is not a PDF", status_code=415)


def _parse_upload(filename: str, data: bytes) -> ParseReport:
    """Parse the PDF from a temp file, then delete it.

    The statement carries an email, a phone number and every UPI
    reference, and nothing reads it after parsing. The parser needs a
    real path, so it lives on disk only for the length of this call.
    """
    check_upload(filename, data)

    # delete=False and close before parsing: Windows will not let the
    # parser open a file that is still held open for writing.
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        with tmp:
            tmp.write(data)
        return parse_statement_report(tmp.name)
    finally:
        os.unlink(tmp.name)


def _already_imported(existing: Statement | None) -> Conflict:
    when = existing.imported_at.strftime("%d %b %Y") if existing else "earlier"
    return Conflict(f"This exact file was already imported ({when}). Nothing was changed.")


async def import_statement(
    user_id: PydanticObjectId, filename: str, data: bytes
) -> Statement:
    report = _parse_upload(filename, data)
    parsed = report.rows
    if not parsed:
        raise AppError(
            "No transactions found. Is this a Google Pay statement?", status_code=422
        )

    file_hash = hashlib.sha256(data).hexdigest()
    existing = await Statement.find_one(
        Statement.user_id == user_id, Statement.file_hash == file_hash
    )
    if existing is not None:
        raise _already_imported(existing)

    statement = Statement(
        user_id=user_id,
        original_filename=filename,
        period_start=min(p.occurred_at for p in parsed),
        period_end=max(p.occurred_at for p in parsed),
        rows_parsed=len(parsed),
        rows_failed=report.skipped,
        total_debit_paise=sum(p.amount_paise for p in parsed if p.direction == "debit"),
        total_credit_paise=sum(p.amount_paise for p in parsed if p.direction == "credit"),
        file_hash=file_hash,
        status="processing",
    )
    try:
        await statement.insert()
    except DuplicateKeyError:
        # The same file, uploaded twice at once. The unique index let
        # exactly one through.
        raise _already_imported(None)

    try:
        accounts = await accounts_service.resolve(
            user_id, {(p.bank, p.account_last4) for p in parsed if p.bank}
        )
        docs = [
            Transaction(
                user_id=user_id,
                statement_id=statement.id,
                account_id=accounts.get((p.bank, p.account_last4)),
                payee_key=normalize_name(p.counterparty_raw),
                txn_id=p.txn_id,
                occurred_at=p.occurred_at,
                direction=p.direction,
                is_self_transfer=p.is_self_transfer,
                counterparty_raw=p.counterparty_raw,
                amount_paise=p.amount_paise,
                bank=p.bank,
                account_last4=p.account_last4,
            )
            for p in parsed
        ]
        inserted, duplicates = await _insert_new_only(docs)
    except Exception:
        # Keep the record of the attempt, but free the hash so the same
        # file can be uploaded again once whatever broke is fixed. Rows
        # that did land are safe to keep: a retry skips them as duplicates.
        statement.status = "failed"
        statement.file_hash = None
        await statement.save()
        logger.exception("statement_import_failed user=%s statement=%s", user_id, statement.id)
        raise

    statement.rows_inserted = inserted
    statement.rows_duplicate = duplicates
    statement.status = "completed"
    await statement.save()

    logger.info(
        "statement_imported user=%s parsed=%s inserted=%s duplicate=%s failed=%s",
        user_id,
        len(parsed),
        inserted,
        duplicates,
        report.skipped,
    )
    return statement


async def _insert_new_only(docs: list[Transaction]) -> tuple[int, int]:
    """Insert every transaction, skipping ones already stored.

    ordered=False keeps going after a failure instead of stopping at the
    first one, so the unique index on (user_id, txn_id) rejects exactly
    the rows that already exist and the rest land. Re-uploading an
    overlapping statement is therefore safe and needs no prior query.
    A row that already exists keeps the statement_id of the upload that
    first brought it in.
    """
    if not docs:
        return 0, 0
    try:
        result = await Transaction.insert_many(docs, ordered=False)
        return len(result.inserted_ids), 0
    except BulkWriteError as exc:
        errors = exc.details.get("writeErrors", [])
        duplicates = sum(1 for e in errors if e.get("code") == DUPLICATE_KEY)
        other = len(errors) - duplicates
        if other:
            # Something other than a repeat. Do not swallow it.
            raise
        return len(docs) - duplicates, duplicates
