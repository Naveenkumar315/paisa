"""Through HTTP, as the frontend sees it: auth, isolation, validation."""

import pytest

from app.services import import_service
from app.services.gpay_parser import ParseReport
from tests.conftest import add_payee, add_txn, register
from tests.test_import import PDF, row


async def test_users_cannot_see_each_other(client):
    a_headers, a_id = await register(client, "a@example.com")
    b_headers, _ = await register(client, "b@example.com")
    t = await add_txn(a_id, "Tea Stall", 6_000)

    assert (await client.get("/transactions", headers=a_headers)).json()["total"] == 1
    assert (await client.get("/transactions", headers=b_headers)).json()["total"] == 0
    assert (await client.get(f"/transactions/{t.id}", headers=b_headers)).status_code == 404
    r = await client.patch(f"/transactions/{t.id}", headers=b_headers, json={"notes": "mine"})
    assert r.status_code == 404
    assert (await client.get("/analytics/months", headers=b_headers)).json() == []
    assert (await client.get("/accounts", headers=b_headers)).json() == []


async def test_everything_needs_a_token(client):
    for path in ("/transactions", "/accounts", "/analytics/months", "/statements"):
        assert (await client.get(path)).status_code == 401, path


async def test_override_validation_and_history(client):
    headers, uid = await register(client, "a@example.com")
    t = await add_txn(uid, "Tea Stall", 6_000)

    r = await client.patch(f"/transactions/{t.id}", headers=headers, json={"type_override": "income"})
    assert r.status_code == 400          # a debit cannot be income
    r = await client.patch(f"/transactions/{t.id}", headers=headers, json={"category_override": "rent"})
    assert r.status_code == 400

    r = await client.patch(
        f"/transactions/{t.id}", headers=headers,
        json={"type_override": "transfer_out", "notes": "  lent to Ravi  "},
    )
    assert r.status_code == 200
    assert (r.json()["txn_type"], r.json()["notes"]) == ("transfer_out", "lent to Ravi")

    # Clearing one field leaves the other alone.
    r = await client.patch(f"/transactions/{t.id}", headers=headers, json={"type_override": None})
    assert (r.json()["txn_type"], r.json()["notes"]) == ("expense", "lent to Ravi")

    history = (await client.get(f"/transactions/{t.id}/history", headers=headers)).json()
    assert [h["changes"] for h in history] == [
        {"type_override": ["transfer_out", None]},
        {"type_override": [None, "transfer_out"], "notes": [None, "lent to Ravi"]},
    ]


async def test_filters(client):
    headers, uid = await register(client, "a@example.com")
    await add_payee(uid, "Tea Stall", "food")
    await add_txn(uid, "Tea Stall", 6_000)
    await add_txn(uid, "Unknown (Shop)", 15_000)
    await add_txn(uid, "Employer", 100_000, "credit")

    async def amounts(**params):
        r = await client.get("/transactions", headers=headers, params=params)
        assert r.status_code == 200, r.text
        return sorted(t["amount_paise"] for t in r.json()["items"])

    assert await amounts(type="expense") == [6_000, 15_000]
    assert await amounts(category="uncategorised", direction="debit") == [15_000]
    assert await amounts(category="food") == [6_000]
    assert await amounts(q="(shop") == [15_000]           # regex characters are just text
    assert await amounts(min_rupees=100, max_rupees=200) == [15_000]
    assert await amounts(**{"from": "2026-09-10", "to": "2026-09-10"}) == [6_000, 15_000, 100_000]
    assert await amounts(**{"from": "2026-09-11"}) == []

    page = (await client.get("/transactions", headers=headers, params={"limit": 1})).json()
    assert (len(page["items"]), page["total"], page["debit_paise"], page["credit_paise"]) == (
        1, 3, 21_000, 100_000,
    )
    bad = await client.get("/transactions", headers=headers, params={"type": "salary"})
    assert bad.status_code == 400


async def test_bad_ids_are_400_not_500(client):
    headers, _ = await register(client, "a@example.com")
    assert (await client.get("/ask/runs/not-an-id", headers=headers)).status_code == 400


async def test_upload_then_accounts(client, monkeypatch):
    headers, _ = await register(client, "a@example.com")
    monkeypatch.setattr(
        import_service, "parse_statement_report",
        lambda path: ParseReport(rows=[row("1", "Tea Stall", 6_000)], skipped=0),
    )
    files = {"file": ("gpay.pdf", PDF, "application/pdf")}
    first = await client.post("/statements", headers=headers, files=files)
    assert first.status_code == 201, first.text
    again = await client.post("/statements", headers=headers, files=files)
    assert again.status_code == 409

    accounts = (await client.get("/accounts", headers=headers)).json()
    assert [(a["name"], a["txn_count"], a["debit_paise"], a["balance_paise"]) for a in accounts] == [
        ("Axis Bank ··1714", 1, 6_000, None),
    ]
    acc_id = accounts[0]["id"]
    r = await client.patch(f"/accounts/{acc_id}", headers=headers,
                           json={"name": "Salary account", "account_type": "savings"})
    assert (r.json()["name"], r.json()["account_type"]) == ("Salary account", "savings")
    r = await client.patch(f"/accounts/{acc_id}", headers=headers, json={"account_type": "piggy"})
    assert r.status_code == 400

    other, _ = await register(client, "b@example.com")
    r = await client.patch(f"/accounts/{acc_id}", headers=other, json={"name": "stolen"})
    assert r.status_code == 404


@pytest.mark.parametrize("name", ["Tea Stall", "TEA STALL"])
async def test_labelling_one_spelling_labels_all(client, name):
    headers, uid = await register(client, "a@example.com")
    await add_payee(uid, "Tea Stall", "food")
    await add_payee(uid, "TEA STALL", "food")
    r = await client.put(f"/payees/{name}", headers=headers, json={"category": "health"})
    assert r.status_code == 200
    payees = (await client.get("/payees", headers=headers)).json()
    assert {(p["category"], p["source"]) for p in payees} == {("health", "user")}
