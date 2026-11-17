"""Tests run against a throwaway database on the local MongoDB.

The name is set before the app is imported, so settings never point at
the real `paisa` database, and the database is dropped at the end.
Run from paisa-api/:  .venv/Scripts/python -m pytest
"""

import os
import uuid

os.environ["MONGO_DB"] = f"moneytrail_test_{uuid.uuid4().hex[:8]}"

from datetime import datetime  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from beanie import PydanticObjectId  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db import session  # noqa: E402
from app.db.models import DOCUMENT_MODELS, Payee, Transaction  # noqa: E402
from app.main import app  # noqa: E402
from app.services.payee_normalize import normalize_name  # noqa: E402


@pytest_asyncio.fixture(scope="session", autouse=True)
async def db():
    # Belt and braces: never run against a real database.
    assert settings.mongo_db.startswith("moneytrail_test_"), settings.mongo_db
    await session.init_db()
    yield session._client[settings.mongo_db]
    await session._client.drop_database(settings.mongo_db)
    await session.close_db()


@pytest_asyncio.fixture(autouse=True)
async def clean(db):
    for model in DOCUMENT_MODELS:
        await model.get_pymongo_collection().delete_many({})
    yield


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    """No test calls the real model. Categorisation answers 'nothing'."""

    async def fake(prompt: str) -> dict:
        return {"payees": []}

    monkeypatch.setattr("app.services.categorize_service.complete_json", fake)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def register(client: AsyncClient, email: str) -> tuple[dict, PydanticObjectId]:
    r = await client.post(
        "/auth/register", json={"email": email, "name": "Test", "password": "password123"}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    return (
        {"Authorization": f"Bearer {body['access_token']}"},
        PydanticObjectId(body["user"]["id"]),
    )


_seq = iter(range(10**9))


async def add_txn(
    user_id: PydanticObjectId,
    party: str,
    amount_paise: int,
    direction: str = "debit",
    when: datetime = datetime(2026, 9, 10, 9, 30),
    **extra,
) -> Transaction:
    return await Transaction(
        user_id=user_id,
        txn_id=f"T{next(_seq)}",
        occurred_at=when,
        direction=direction,
        counterparty_raw=party,
        payee_key=normalize_name(party),
        amount_paise=amount_paise,
        bank="Axis Bank",
        account_last4="1714",
        **extra,
    ).insert()


async def add_payee(user_id: PydanticObjectId, name: str, category: str, source: str = "llm") -> Payee:
    return await Payee(
        user_id=user_id, name=name, normalized_name=normalize_name(name),
        category=category, source=source,
    ).insert()
