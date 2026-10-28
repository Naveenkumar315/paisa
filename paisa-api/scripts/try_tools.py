import asyncio

from app.db.models import User
from app.db.session import close_db, init_db
from app.services.tools import run_tool


async def main() -> None:
    await init_db()
    user = await User.find_one()
    print("user:", user.email)

    for name, args in [
        ("list_months", {}),
        ("get_spending", {"month": "2026-09"}),
        ("get_spending", {"month": "2026-09", "category": "food"}),
        ("get_payee_total", {"name": "jio"}),
        ("top_payees", {"month": "2026-09", "limit": 3}),
        ("compare_months", {"month_a": "2026-08", "month_b": "2026-09"}),
        # Deliberately wrong, to see the error come back as data.
        ("get_spending", {"month": "September"}),
        ("no_such_tool", {}),
    ]:
        print(f"\n--- {name} {args}")
        print(await run_tool(user.id, name, args))

    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
