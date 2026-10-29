import logging
import os
import tempfile

from beanie import PydanticObjectId
from pymongo.errors import BulkWriteError

from app.core.config import settings
from app.core.errors import AppError
from app.db.models import Statement, Transaction
from app.services.gpay_parser import ParsedTxn, parse_statement

logger = logging.getLogger("paisa")

DUPLICATE_KEY = 11000


def _parse_upload(filename: str, data: bytes) -> list[ParsedTxn]:
    """Parse the PDF from a temp file, then delete it.

    The statement carries an email, a phone number and every UPI
    reference, and nothing reads it after parsing. The parser needs a
    real path, so it lives on disk only for the length of this call.
    """
    if not filename.lower().endswith(".pdf"):
        raise AppError("Only PDF statements are supported", status_code=415)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise AppError(
            f"File is over {settings.max_upload_mb}MB", status_code=413)

    # delete=False and close before parsing: Windows will not let the
    # parser open a file that is still held open for writing.
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    try:
        with tmp:
            tmp.write(data)
        return parse_statement(tmp.name)
    finally:
        os.unlink(tmp.name)


async def import_statement(
    user_id: PydanticObjectId, filename: str, data: bytes
) -> Statement:
    parsed = _parse_upload(filename, data)
    if not parsed:
        raise AppError(
            "No transactions found. Is this a Google Pay statement?", status_code=422
        )

    statement = Statement(
        user_id=user_id,
        original_filename=filename,
        period_start=min(p.occurred_at for p in parsed),
        period_end=max(p.occurred_at for p in parsed),
        rows_parsed=len(parsed),
    )
    await statement.insert()

    docs = [
        Transaction(
            user_id=user_id,
            statement_id=statement.id,
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

    statement.rows_inserted = inserted
    statement.rows_duplicate = duplicates
    await statement.save()

    logger.info(
        "statement_imported user=%s parsed=%s inserted=%s duplicate=%s",
        user_id,
        len(parsed),
        inserted,
        duplicates,
    )
    return statement


async def _insert_new_only(docs: list[Transaction]) -> tuple[int, int]:
    """Insert every transaction, skipping ones already stored.

    ordered=False keeps going after a failure instead of stopping at the
    first one, so the unique index on (user_id, txn_id) rejects exactly
    the rows that already exist and the rest land. Re-uploading an
    overlapping statement is therefore safe and needs no prior query.
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
