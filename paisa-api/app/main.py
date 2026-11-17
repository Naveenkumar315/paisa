import logging

from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import DEFAULT_JWT_SECRET, settings
from app.db.migrations import run_pending
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.middleware import register_middleware
from app.db.session import close_db, init_db, ping
from app.api.statements import router as statements_router
from app.api.auth import router as auth_router
from app.api.analytics import router as analytics_router
from app.api.payees import router as payees_router
from app.api.ask import router as ask_router
from app.api.transactions import router as transactions_router
from app.api.accounts import router as accounts_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting app=%s env=%s", settings.app_name, settings.env)
    if settings.jwt_secret == DEFAULT_JWT_SECRET:
        logger.warning(
            "JWT_SECRET is not set: tokens are signed with the public default. "
            "Set JWT_SECRET in paisa-api/.env before this runs anywhere but your machine."
        )
    await init_db()
    logger.info("mongo connected db=%s", settings.mongo_db)
    # Classification joins on fields the migrations fill in, so they run
    # before the first request. Each is additive and idempotent.
    applied = await run_pending()
    if applied:
        logger.info("migrations applied: %s", ", ".join(applied))
    yield
    await close_db()
    logger.info("shutdown complete")

setup_logging(settings.log_level)
logger = logging.getLogger("moneytrail")

app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(statements_router)
app.include_router(analytics_router)
app.include_router(payees_router)
app.include_router(ask_router)
app.include_router(transactions_router)
app.include_router(accounts_router)


register_middleware(app)
register_error_handlers(app)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.env}


@app.get("/health/db")
async def health_db():
    return {"mongo": "up" if await ping() else "down"}
