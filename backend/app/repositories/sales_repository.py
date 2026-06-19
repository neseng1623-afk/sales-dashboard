from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


# app2.py の table_df SQL がベース。
# 集計列・GROUP BY・JOIN条件は維持し、PostgreSQLで動かすために
# strftime を to_char、非ASCII列名を quoted identifier に置き換えている。
# 接続先は既存DBの sales_row。m_customer が無いため、補助科目を顧客名として返す。
SALES_SUMMARY_SQL = text(
    """
    SELECT
        s."部門",
        NULL::integer AS "顧客ID",
        s."補助科目" AS "顧客名",
        to_char(s."日付", 'YYYY-MM') AS "年月",
        to_char(s."日付", 'YYYY') AS "年",
        EXTRACT(MONTH FROM s."日付")::integer AS "月",
        s."仕訳メモ" AS "カテゴリ",
        SUM(COALESCE(s."貸方金額", 0) - COALESCE(s."借方金額", 0)) AS "売上",
        SUM(COALESCE(s."原価", 0)) AS "原価",
        SUM(
            COALESCE(s."貸方金額", 0)
            - COALESCE(s."借方金額", 0)
        ) - SUM(COALESCE(s."原価", 0)) AS "粗利"
    FROM sales_row s
    GROUP BY s."部門", s."補助科目", "年月", "年", "月", s."仕訳メモ"
    ORDER BY "年", "月"
    """
)


# app2.py の base_df SQL がベース。
# 部門別売上推移の元データとして、年月・部門・顧客名・売上金額を返す。
SALES_TREND_SQL = text(
    """
    SELECT
        to_char(s."日付", 'YYYY-MM') AS "年月",
        s."部門",
        s."補助科目" AS "顧客名",
        SUM(COALESCE(s."貸方金額", 0) - COALESCE(s."借方金額", 0)) AS "売上金額"
    FROM sales_row s
    GROUP BY "年月", s."部門", s."補助科目"
    """
)


def fetch_sales_summary_rows(db: Session) -> list[dict[str, Any]]:
    result = db.execute(SALES_SUMMARY_SQL)
    return [dict(row) for row in result.mappings().all()]


def fetch_sales_trend_rows(db: Session) -> list[dict[str, Any]]:
    result = db.execute(SALES_TREND_SQL)
    return [dict(row) for row in result.mappings().all()]
