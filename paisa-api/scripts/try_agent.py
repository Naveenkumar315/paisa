import asyncio

from app.db.models import User
from app.db.session import close_db, init_db
from app.services.agent_service import ask


async def main() -> None:
    await init_db()
    user = await User.find_one()

    for question in [
        "How much did I spend on food last month?",
        "Why was August higher than September?",
        "How much do I pay Jio in total?",
    ]:
        print(f"\nQ: {question}")
        result = await ask(user.id, question)
        print(f"A: {result['answer']}")
        print(
            f"   {result['steps']} steps, {result['tokens']} tokens, {result['duration_ms']}ms")

    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
