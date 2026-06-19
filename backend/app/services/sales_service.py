from collections import defaultdict
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.repositories.sales_repository import (
    fetch_sales_summary_rows,
    fetch_sales_trend_rows,
)


def _number(value: Any) -> float:
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return float(value)


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value == value.to_integral_value():
            return int(value)
        return float(value)
    return value


def _json_safe_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: _json_safe(value) for key, value in row.items()}


def _sum_by(rows: list[dict[str, Any]], key: str, value_key: str, limit: int | None = None) -> list[dict[str, Any]]:
    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        name = row.get(key)
        if name is not None:
            totals[str(name)] += _number(row.get(value_key))

    items = [
        {"name": name, "value": value}
        for name, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)
    ]
    return items[:limit] if limit else items


def build_sales_dashboard(db: Session) -> dict[str, Any]:
    table_rows = fetch_sales_summary_rows(db)
    trend_rows = fetch_sales_trend_rows(db)

    if not table_rows:
        return {
            "kpis": {
                "latestMonth": None,
                "latestSales": 0,
                "latestCost": 0,
                "latestGross": 0,
                "profitRate": 0,
                "salesYoY": 0,
                "grossYoY": 0,
            },
            "latestBars": {"departments": [], "categories": [], "customers": []},
            "trend": [],
            "composition": {"departments": [], "categories": [], "customers": []},
            "table": [],
        }

    latest_month = max(str(row["年月"]) for row in table_rows if row.get("年月"))
    latest_rows = [row for row in table_rows if row.get("年月") == latest_month]

    latest_year, latest_month_number = latest_month.split("-")
    last_year_month = f"{int(latest_year) - 1}-{latest_month_number}"
    last_year_rows = [row for row in table_rows if row.get("年月") == last_year_month]

    latest_sales = sum(_number(row.get("売上")) for row in latest_rows)
    latest_cost = sum(_number(row.get("原価")) for row in latest_rows)
    latest_gross = sum(_number(row.get("粗利")) for row in latest_rows)
    last_year_sales = sum(_number(row.get("売上")) for row in last_year_rows)
    last_year_gross = sum(_number(row.get("粗利")) for row in last_year_rows)

    trend_totals: dict[str, float] = defaultdict(float)
    for row in trend_rows:
        if row.get("年月"):
            trend_totals[str(row["年月"])] += _number(row.get("売上金額"))

    trend = [
        {"month": month, "sales": value}
        for month, value in sorted(trend_totals.items())[-12:]
    ]

    return {
        "kpis": {
            "latestMonth": latest_month,
            "latestSales": latest_sales,
            "latestCost": latest_cost,
            "latestGross": latest_gross,
            "profitRate": (latest_gross / latest_sales * 100) if latest_sales else 0,
            "salesYoY": ((latest_sales - last_year_sales) / last_year_sales * 100) if last_year_sales else 0,
            "grossYoY": ((latest_gross - last_year_gross) / last_year_gross * 100) if last_year_gross else 0,
        },
        "latestBars": {
            "departments": _sum_by(latest_rows, "部門", "売上"),
            "categories": _sum_by(latest_rows, "カテゴリ", "売上"),
            "customers": _sum_by(latest_rows, "顧客名", "売上", limit=3),
        },
        "trend": trend,
        "composition": {
            "departments": _sum_by(table_rows, "部門", "売上"),
            "categories": _sum_by(table_rows, "カテゴリ", "売上"),
            "customers": _sum_by(table_rows, "顧客名", "売上", limit=5),
        },
        "table": [_json_safe_row(row) for row in table_rows],
    }

