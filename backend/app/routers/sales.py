from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.sales_service import build_sales_dashboard


router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/dashboard")
def read_sales_dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    try:
        return build_sales_dashboard(db)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard data") from exc

