"""The Ask agent's tools: same numbers as the dashboard, scoped to one user."""

from beanie import PydanticObjectId

from app.services import analytics_service
from app.services.tools import run_tool
from tests.conftest import add_payee, add_txn


async def test_tool_totals_match_dashboard():
    uid = PydanticObjectId()
    await add_payee(uid, "Ravi", "transfer")
    await add_txn(uid, "Tea Stall", 6_000)
    await add_txn(uid, "Ravi", 50_000)
    await add_txn(uid, "Own", 900_000, is_self_transfer=True)

    month = (await analytics_service.monthly_summaries(uid))[0]
    tool = await run_tool(uid, "get_spending", {"month": "2026-09"})
    assert tool["total_rupees"] == f"{month['spending_paise'] / 100:,.2f}" == "560.00"


async def test_payee_search_is_text_not_a_pattern():
    uid = PydanticObjectId()
    await add_txn(uid, "Shop (Main Road)", 6_000)
    result = await run_tool(uid, "get_payee_total", {"name": "(main"})
    assert "error" not in result
    assert result["matched"][0]["total_rupees"] == "60.00"
    # ".*" would match everything if it were a pattern.
    assert (await run_tool(uid, "get_payee_total", {"name": ".*"}))["matched"] == []


async def test_tools_only_see_their_user():
    me, other = PydanticObjectId(), PydanticObjectId()
    await add_txn(other, "Tea Stall", 6_000)
    assert (await run_tool(me, "list_months", {}))["months"] == []
    assert (await run_tool(me, "get_payee_total", {"name": "tea"}))["matched"] == []
    # The model cannot pick the user by passing one in.
    hijack = await run_tool(me, "list_months", {"user_id": str(other)})
    assert "error" in hijack


async def test_overridden_self_transfer_leaves_payee_totals():
    uid = PydanticObjectId()
    t = await add_txn(uid, "My Other Bank", 50_000)
    t.type_override = "self_transfer"
    await t.save()
    assert (await run_tool(uid, "get_payee_total", {"name": "other bank"}))["matched"] == []
