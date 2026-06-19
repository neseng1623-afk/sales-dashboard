CREATE TABLE IF NOT EXISTS sales_raw (
    "伝票No." TEXT PRIMARY KEY,
    "仕訳番号" INTEGER,
    "借方金額" NUMERIC(12, 2) DEFAULT 0,
    "残高" NUMERIC(12, 2) DEFAULT 0,
    "日付" TEXT NOT NULL,
    "補助科目" TEXT,
    "部門" TEXT,
    "仕訳メモ" TEXT,
    "貸方金額" NUMERIC(12, 2) DEFAULT 0,
    "原価" NUMERIC(12, 2) DEFAULT 0,
    "摘要" TEXT,
    "[表題行]" TEXT
);

CREATE TABLE IF NOT EXISTS m_customer (
    customer_id SERIAL PRIMARY KEY,
    customer_name TEXT UNIQUE
);

INSERT INTO sales_raw (
    "伝票No.",
    "仕訳番号",
    "借方金額",
    "残高",
    "日付",
    "補助科目",
    "部門",
    "仕訳メモ",
    "貸方金額",
    "原価",
    "摘要",
    "[表題行]"
)
VALUES
    ('D00001', 1, 0, 0, '2025-06-01', '顧客A', '営業1部', 'ソフトウェア', 320000, 140000, 'なし', 'なし'),
    ('D00002', 2, 0, 0, '2025-06-10', '顧客B', '営業2部', '保守', 180000, 80000, 'なし', 'なし'),
    ('D00003', 3, 0, 0, '2026-06-02', '顧客A', '営業1部', 'ソフトウェア', 450000, 190000, 'なし', 'なし'),
    ('D00004', 4, 0, 0, '2026-06-08', '顧客C', '営業3部', '機器', 260000, 130000, 'なし', 'なし'),
    ('D00005', 5, 0, 0, '2026-05-22', '顧客B', '営業2部', '保守', 220000, 90000, 'なし', 'なし')
ON CONFLICT ("伝票No.") DO NOTHING;

INSERT INTO m_customer (customer_name)
SELECT DISTINCT "補助科目"
FROM sales_raw
WHERE "補助科目" IS NOT NULL AND "補助科目" <> ''
ON CONFLICT (customer_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS sales_row (
    id SERIAL PRIMARY KEY,
    sale_date DATE NOT NULL,
    product TEXT NOT NULL,
    region TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    amount NUMERIC(12, 2) NOT NULL
);

