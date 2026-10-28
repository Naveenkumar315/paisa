import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("paisa")


class AppError(Exception):
    """Business errors. Raise anywhere, it becomes clean JSON."""

    def __init__(self, message: str, status_code: int = 400, code: str = "app_error"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class NotFound(AppError):
    def __init__(self, message: str = "Not found"):
        super().__init__(message, 404, "not_found")


class Conflict(AppError):
    def __init__(self, message: str = "Already exists"):
        super().__init__(message, 409, "conflict")


class Unauthorized(AppError):
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message, 401, "unauthorized")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        logger.warning("app_error code=%s path=%s", exc.code, request.url.path)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("unhandled path=%s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error",
                               "message": "Something went wrong"}},
        )
