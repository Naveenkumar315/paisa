"""python -m app.db.migrations [--dry-run]  (run from paisa-api/)"""

import asyncio
import json
import sys

from app.db.migrations import run_pending
from app.db.session import close_db, init_db


async def main() -> None:
    dry_run = "--dry-run" in sys.argv
    await init_db()
    try:
        results = await run_pending(dry_run=dry_run)
        print(json.dumps(results or "nothing pending", indent=2))
    finally:
        await close_db()


asyncio.run(main())
