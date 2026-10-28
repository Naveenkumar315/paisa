from beanie import init_beanie
from pymongo import AsyncMongoClient          # motor illa

from app.core.config import settings
from app.db.models import DOCUMENT_MODELS

_client: AsyncMongoClient | None = None


async def init_db() -> None:
    global _client
    _client = AsyncMongoClient(settings.mongo_uri)
    await init_beanie(
        database=_client[settings.mongo_db],
        document_models=DOCUMENT_MODELS,
    )


async def close_db() -> None:
    if _client is not None:
        await _client.close()          # ippo await venum


async def ping() -> bool:
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
        return True
    except Exception:
        return False
