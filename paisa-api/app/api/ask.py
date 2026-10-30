from beanie import PydanticObjectId
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.core.errors import NotFound
from app.db.models import AgentRun, User
from app.services import agent_service

router = APIRouter(prefix="/ask", tags=["ask"])


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    thread_id: str | None = None


@router.post("")
async def ask(body: AskIn, user: User = Depends(get_current_user)):
    thread_id = PydanticObjectId(body.thread_id) if body.thread_id else None
    return await agent_service.ask(user.id, body.question, thread_id)


@router.get("/threads")
async def list_threads(user: User = Depends(get_current_user)):
    pipeline = [
        # Runs from before threads existed have no thread_id and would
        # otherwise collapse into one null group.
        {"$match": {"user_id": user.id, "thread_id": {"$ne": None}}},
        {"$sort": {"created_at": 1}},
        {
            "$group": {
                "_id": "$thread_id",
                "title": {"$first": "$question"},
                "runs": {"$sum": 1},
                "last_at": {"$max": "$created_at"},
            }
        },
        {"$sort": {"last_at": -1}},
    ]
    rows = await AgentRun.aggregate(pipeline).to_list()
    return [
        {
            "thread_id": str(r["_id"]),
            "title": r["title"],
            "runs": r["runs"],
            "last_at": r["last_at"],
        }
        for r in rows
    ]


@router.get("/runs")
async def list_runs(user: User = Depends(get_current_user), limit: int = 20):
    rows = (
        await AgentRun.find(AgentRun.user_id == user.id)
        .sort(-AgentRun.created_at)
        .limit(limit)
        .to_list()
    )
    return [
        {
            "run_id": str(r.id),
            "question": r.question,
            "answer": r.answer,
            "steps": r.steps,
            "tokens": r.tokens,
            "duration_ms": r.duration_ms,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/runs/{run_id}")
async def get_run(run_id: str, user: User = Depends(get_current_user)):
    trace = await agent_service.get_trace(user.id, PydanticObjectId(run_id))
    if not trace:
        raise NotFound("No such run")
    return trace
