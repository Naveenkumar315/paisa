"""Data migrations for MongoDB.

Mongo has no schema to migrate, so a "migration" here is a script that
fills in fields older documents do not have. The rules every migration
follows:

- Additive only. Set a field where it is missing; never delete or
  rewrite an existing value.
- Idempotent. Running it twice changes nothing the second time, so a
  crash halfway is fixed by running it again.
- Recorded in the `migrations` collection once it completes.

They run at API startup (app/main.py), because the queries depend on the
fields they fill in. Run by hand, with a dry run first:

    python -m app.db.migrations --dry-run
    python -m app.db.migrations
"""

import logging
from collections.abc import Awaitable, Callable

from pymongo.errors import DuplicateKeyError

from app.db.migrations import m001_payee_keys, m002_accounts
from app.db.models import MigrationRecord

logger = logging.getLogger("moneytrail")

Migration = Callable[[bool], Awaitable[dict]]

MIGRATIONS: list[tuple[str, Migration]] = [
    ("001_payee_keys", m001_payee_keys.run),
    ("002_accounts", m002_accounts.run),
]


async def run_pending(dry_run: bool = False) -> dict[str, dict]:
    applied = {r.name for r in await MigrationRecord.find_all().to_list()}
    results: dict[str, dict] = {}
    for name, migrate in MIGRATIONS:
        if name in applied:
            continue
        result = await migrate(dry_run)
        results[name] = result
        logger.info("migration name=%s dry_run=%s result=%s", name, dry_run, result)
        if not dry_run:
            try:
                await MigrationRecord(name=name, result=result).insert()
            except DuplicateKeyError:
                # Another process finished it first. The work is
                # idempotent, so both runs leave the same data.
                pass
    return results
