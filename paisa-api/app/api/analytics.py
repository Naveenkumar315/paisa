from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.errors import NotFound
from app.db.models import User
from app.schemas.analytics import (
    CategorySlice,
    ClockBucket,
    MonthSummary,
    PayeeSummary,
)
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/months", response_model=list[MonthSummary])
async def months(user: User = Depends(get_current_user)):
    return await analytics_service.monthly_summaries(user.id)


@router.get("/summary", response_model=MonthSummary)
async def summary(month: str = Query(...), user: User = Depends(get_current_user)):
    rows = await analytics_service.monthly_summaries(user.id)
    found = next((m for m in rows if m["month"] == month), None)
    if found is None:
        raise NotFound(f"No data for {month}")
    return found


@router.get("/payees", response_model=list[PayeeSummary])
async def payees(
    limit: int = Query(12, ge=1, le=100),
    month: str | None = Query(None),
    user: User = Depends(get_current_user),
):
    return await analytics_service.payee_summaries(user.id, limit, month)


@router.get("/clock", response_model=list[ClockBucket])
async def clock(user: User = Depends(get_current_user)):
    return await analytics_service.clock_buckets(user.id)


@router.get("/categories", response_model=list[CategorySlice])
async def categories(month: str = Query(...), user: User = Depends(get_current_user)):
    return await analytics_service.category_slices(user.id, month)


@router.get("/people")
async def people(user: User = Depends(get_current_user)):
    return await analytics_service.people_balances(user.id)


@router.get("/people/{name}")
async def person(name: str, user: User = Depends(get_current_user)):
    return await analytics_service.person_ledger(user.id, name)


@router.get("/daily")
async def daily(user: User = Depends(get_current_user)):
    return await analytics_service.daily_series(user.id)


@router.get("/category-trend")
async def trend(user: User = Depends(get_current_user)):
    return await analytics_service.category_trend(user.id)


@router.get("/mobile-recharges")
async def mobile_recharges(user: User = Depends(get_current_user)):
    return await analytics_service.mobile_recharges(user.id)
