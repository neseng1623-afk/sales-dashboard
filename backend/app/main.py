from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.routers.sales import router as sales_router


settings = get_settings()

app = FastAPI(title="Sales Row API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sales_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/sales-row")
def read_sales_row(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        result = db.execute(
            text("SELECT * FROM sales_row ORDER BY 1 LIMIT :limit OFFSET :offset"),
            {"limit": limit, "offset": offset},
        )
        rows = [dict(row) for row in result.mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch sales_row") from exc

    return {"items": rows, "limit": limit, "offset": offset, "count": len(rows)}
