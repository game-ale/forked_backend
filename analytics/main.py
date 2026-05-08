import logging

from fastapi import FastAPI, HTTPException, Query
from psycopg import Error as PsycopgError

from analytics.config import settings
from analytics.db import (
    check_database_connection,
    close_connection_pool,
    fetch_telemetry_sample,
    init_connection_pool,
)

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)
db_startup_check_passed = True


@app.on_event("startup")
def startup_checks() -> None:
    global db_startup_check_passed
    init_connection_pool()
    try:
        check_database_connection()
    except PsycopgError:
        db_startup_check_passed = False
        logger.exception("Startup database connection check failed")


@app.on_event("shutdown")
def shutdown_cleanup() -> None:
    close_connection_pool()


@app.get("/health")
def health() -> dict[str, str]:
    database_status = "reachable" if db_startup_check_passed else "unreachable"
    return {
        "status": "ok" if db_startup_check_passed else "degraded",
        "environment": settings.app_env,
        "database": database_status,
    }


if settings.app_env.lower() == "development":
    @app.get("/telemetry/sample")
    def telemetry_sample(limit: int = Query(default=10, ge=1, le=100)) -> dict[str, object]:
        try:
            rows = fetch_telemetry_sample(limit)
        except PsycopgError as exc:
            logger.exception("Telemetry sample query failed")
            raise HTTPException(
                status_code=500,
                detail="Database query failed.",
            ) from exc

        return {
            "table": settings.telemetry_table,
            "count": len(rows),
            "rows": rows,
        }
