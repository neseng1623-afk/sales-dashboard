import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import "./App.css";

type JsonValue = string | number | boolean | null;
type SalesRow = Record<string, JsonValue>;

type ChartPoint = {
  name?: string;
  month?: string;
  value?: number;
  sales?: number;
};

type DashboardResponse = {
  kpis: {
    latestMonth: string | null;
    latestSales: number;
    latestCost: number;
    latestGross: number;
    profitRate: number;
    salesYoY: number;
    grossYoY: number;
  };
  latestBars: {
    departments: ChartPoint[];
    categories: ChartPoint[];
    customers: ChartPoint[];
  };
  trend: ChartPoint[];
  composition: {
    departments: ChartPoint[];
    categories: ChartPoint[];
    customers: ChartPoint[];
  };
  table: SalesRow[];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const tableColumns = ["年月", "顧客名", "部門", "カテゴリ", "売上", "原価", "粗利"];
const numberColumns = ["売上", "原価", "粗利", "粗利率"];
const palette = ["#06b6d4", "#818cf8", "#34d399", "#fbbf24", "#fb7185"];
const pageSize = 100;

function formatValue(value: JsonValue) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatCurrency(value: number) {
  return `¥${Math.round(value).toLocaleString()}`;
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `¥${(value / 1_000_000).toFixed(1)}M`;
  }

  return `¥${Math.round(value / 1_000).toLocaleString()}K`;
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function asNumber(value: JsonValue) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function getString(row: SalesRow, key: string) {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function uniqueSorted(rows: SalesRow[], key: string) {
  return Array.from(new Set(rows.map((row) => getString(row, key)).filter(Boolean))).sort();
}

function uniqueSortedNumbers(rows: SalesRow[], key: string) {
  return Array.from(new Set(rows.map((row) => asNumber(row[key])).filter((value) => value > 0))).sort(
    (a, b) => a - b,
  );
}

function sumBy(rows: SalesRow[], key: string, limit?: number): ChartPoint[] {
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const name = getString(row, key);
    if (!name) {
      return;
    }

    totals.set(name, (totals.get(name) ?? 0) + asNumber(row["売上"]));
  });

  const items = Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function SelectControl({
  label,
  value,
  options,
  allLabel = "全て",
  onChange,
}: {
  label: string;
  value: string;
  options: Array<string | number>;
  allLabel?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="ALL">{allLabel}</option>
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "cyan",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "cyan" | "violet" | "green" | "rose" | "slate";
}) {
  return (
    <div className={`kpi-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{sub}</em>
    </div>
  );
}

function HorizontalBars({
  title,
  data,
  color,
}: {
  title: string;
  data: ChartPoint[];
  color: string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value ?? 0), 1);

  return (
    <section className="chart-card">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="bar-list">
        {data.length === 0 ? <p className="empty-note">データがありません</p> : null}
        {data.map((item) => {
          const value = item.value ?? 0;
          return (
            <div className="bar-row" key={item.name}>
              <div className="bar-meta">
                <span>{item.name}</span>
                <strong>{formatCompactCurrency(value)}</strong>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.max((value / maxValue) * 100, 4)}%`,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LineChart({
  data,
  action,
}: {
  data: ChartPoint[];
  action?: ReactNode;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 1040;
  const height = 360;
  const paddingX = 76;
  const paddingTop = 32;
  const paddingBottom = 66;
  const values = data.map((item) => item.sales ?? 0);
  const max = Math.max(...values, 1) * 1.12;
  const min = 0;
  const range = Math.max(max - min, 1);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => min + range * ratio);
  const points = data.map((item, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * (width - paddingX * 2);
    const y =
      height -
      paddingBottom -
      (((item.sales ?? 0) - min) / range) * (height - paddingTop - paddingBottom);
    return { x, y, item };
  });
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex];
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length
    ? `${path} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${
        height - paddingBottom
      } Z`
    : "";
  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - bounds.left) / bounds.width) * width;
    const nearestIndex = points.reduce((nearest, point, index) => {
      const nearestDistance = Math.abs(points[nearest].x - viewX);
      const distance = Math.abs(point.x - viewX);
      return distance < nearestDistance ? index : nearest;
    }, 0);
    setHoveredIndex(nearestIndex);
  };

  return (
    <section className="chart-card wide-card trend-card">
      <div className="section-heading">
        <div>
          <h2>部門別売上推移</h2>
          <span>直近12ヶ月</span>
        </div>
        {action}
      </div>
      <div className="line-chart-wrap">
        <svg
          className="line-chart"
          onMouseLeave={() => setHoveredIndex(null)}
          onMouseMove={handleMouseMove}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
          aria-label="売上推移"
        >
          <defs>
            <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect className="chart-hit-area" x={0} y={0} width={width} height={height} />
          {yTicks.map((value, line) => {
            const y = paddingTop + line * ((height - paddingTop - paddingBottom) / (yTicks.length - 1));
            return (
              <g key={value}>
                <line className="grid-line" x1={paddingX} x2={width - paddingX} y1={y} y2={y} />
                <text className="y-axis-label" x={paddingX - 12} y={y + 4}>
                  {formatCompactCurrency(value)}
                </text>
              </g>
            );
          })}
          {areaPath ? <path className="area-path" d={areaPath} /> : null}
          {path ? <path className="line-path" d={path} /> : null}
          {hoveredPoint ? (
            <line
              className="hover-guide"
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={paddingTop}
              y2={height - paddingBottom}
            />
          ) : null}
          {points.map((point) => (
            <g key={`${point.item.month}-${point.x}`}>
              <circle
                className={point === hoveredPoint ? "line-dot active" : "line-dot"}
                cx={point.x}
                cy={point.y}
                r={point === hoveredPoint ? "7" : "5"}
              />
              <title>{`${point.item.month}: ${formatCurrency(point.item.sales ?? 0)}`}</title>
            </g>
          ))}
          {points.map((point) => (
            <text className="axis-label" key={`label-${point.item.month}`} x={point.x} y={height - 16}>
              {point.item.month}
            </text>
          ))}
        </svg>
        {hoveredPoint ? (
          <div
            className="chart-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
            }}
          >
            <span>{hoveredPoint.item.month}</span>
            <strong>{formatCurrency(hoveredPoint.item.sales ?? 0)}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CompositionCard({ title, data }: { title: string; data: ChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + (item.value ?? 0), 0);
  let cursor = 0;
  const stops = data
    .map((item, index) => {
      const pct = total ? ((item.value ?? 0) / total) * 100 : 0;
      const start = cursor;
      cursor += pct;
      return `${palette[index % palette.length]} ${start}% ${cursor}%`;
    })
    .join(", ");

  return (
    <section className="chart-card">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <div className="donut-layout">
        <div
          className="donut"
          style={{ background: stops ? `conic-gradient(${stops})` : "rgba(148, 163, 184, 0.2)" }}
        >
          <div>
            <strong>{formatCompactCurrency(total)}</strong>
            <span>合計</span>
          </div>
        </div>
        <div className="legend-list">
          {data.map((item, index) => {
            const pct = total ? (((item.value ?? 0) / total) * 100).toFixed(1) : "0.0";
            return (
              <div className="legend-row" key={item.name}>
                <span className="legend-dot" style={{ background: palette[index % palette.length] }} />
                <span>{item.name}</span>
                <strong>{pct}%</strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartDept, setChartDept] = useState("ALL");
  const [pieYear, setPieYear] = useState("ALL");
  const [pieMonth, setPieMonth] = useState("ALL");
  const [tableYear, setTableYear] = useState("ALL");
  const [tableMonth, setTableMonth] = useState("ALL");
  const [tableDept, setTableDept] = useState("ALL");
  const [tableCategory, setTableCategory] = useState("ALL");
  const [tableCustomer, setTableCustomer] = useState("ALL");
  const [page, setPage] = useState(1);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/sales/dashboard`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as DashboardResponse;
      setDashboard(data);
      setRows(data.table);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const latestRowCount = useMemo(() => {
    if (!dashboard?.kpis.latestMonth) {
      return 0;
    }

    return rows.filter((row) => row["年月"] === dashboard.kpis.latestMonth).length;
  }, [dashboard?.kpis.latestMonth, rows]);

  const years = useMemo(() => uniqueSorted(rows, "年"), [rows]);
  const months = useMemo(() => uniqueSortedNumbers(rows, "月"), [rows]);
  const departments = useMemo(() => uniqueSorted(rows, "部門"), [rows]);
  const categories = useMemo(() => uniqueSorted(rows, "カテゴリ"), [rows]);

  const latestRows = useMemo(() => {
    if (!dashboard?.kpis.latestMonth) {
      return [];
    }

    return rows.filter((row) => getString(row, "年月") === dashboard.kpis.latestMonth);
  }, [dashboard?.kpis.latestMonth, rows]);

  const latestBars = useMemo(
    () => ({
      departments: sumBy(latestRows, "部門"),
      categories: sumBy(latestRows, "カテゴリ"),
      customers: sumBy(latestRows, "顧客名", 3),
    }),
    [latestRows],
  );

  const trendData = useMemo(() => {
    const baseRows = chartDept === "ALL" ? rows : rows.filter((row) => getString(row, "部門") === chartDept);
    const monthsInScope = Array.from(new Set(baseRows.map((row) => getString(row, "年月")).filter(Boolean)))
      .sort()
      .slice(-12);

    return monthsInScope.map((month) => ({
      month,
      sales: baseRows
        .filter((row) => getString(row, "年月") === month)
        .reduce((sum, row) => sum + asNumber(row["売上"]), 0),
    }));
  }, [chartDept, rows]);

  const pieRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (pieYear === "ALL" || getString(row, "年") === pieYear) &&
          (pieMonth === "ALL" || String(asNumber(row["月"])) === pieMonth),
      ),
    [pieMonth, pieYear, rows],
  );

  const composition = useMemo(
    () => ({
      departments: sumBy(pieRows, "部門"),
      categories: sumBy(pieRows, "カテゴリ"),
      customers: sumBy(pieRows, "顧客名", 5),
    }),
    [pieRows],
  );

  const tableBaseRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (tableYear === "ALL" || getString(row, "年") === tableYear) &&
          (tableMonth === "ALL" || String(asNumber(row["月"])) === tableMonth) &&
          (tableDept === "ALL" || getString(row, "部門") === tableDept) &&
          (tableCategory === "ALL" || getString(row, "カテゴリ") === tableCategory),
      ),
    [rows, tableCategory, tableDept, tableMonth, tableYear],
  );

  const tableCustomers = useMemo(() => uniqueSorted(tableBaseRows, "顧客名"), [tableBaseRows]);

  useEffect(() => {
    if (tableCustomer !== "ALL" && !tableCustomers.includes(tableCustomer)) {
      setTableCustomer("ALL");
    }
  }, [tableCustomer, tableCustomers]);

  const filteredRows = useMemo(
    () =>
      tableBaseRows.filter((row) => tableCustomer === "ALL" || getString(row, "顧客名") === tableCustomer),
    [tableBaseRows, tableCustomer],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page],
  );

  useEffect(() => {
    setPage(1);
  }, [tableCategory, tableCustomer, tableDept, tableMonth, tableYear]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const setTableFilter = (setter: (value: string) => void, value: string, resetCustomer = false) => {
    setter(value);
    if (resetCustomer) {
      setTableCustomer("ALL");
    }
  };

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SaasPulse</strong>
            <span>Sales Analytics</span>
          </div>
        </div>
        <nav className="nav-list">
          <button className="active">ダッシュボード</button>
          <button>売上分析</button>
          <button>マスタ管理</button>
          <button>通知</button>
          <button>設定</button>
        </nav>
        <div className="user-panel">
          <div className="avatar">管</div>
          <div>
            <strong>管理者</strong>
            <span>admin@saaspulse.jp</span>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <h1>売上ダッシュボード</h1>
            <p>
              最新年月: {dashboard?.kpis.latestMonth ?? "-"} ・ 全 {rows.length.toLocaleString()} 件
            </p>
          </div>
          <div className="topbar-actions">
            <span className="live-badge">ライブ</span>
            <button className="refresh-button" disabled={isLoading} onClick={loadDashboard}>
              Reload
            </button>
          </div>
        </header>

        {isLoading ? <div className="state state-dark">Loading...</div> : null}
        {error ? <div className="state state-error">{error}</div> : null}

        {dashboard ? (
          <div className="content-stack">
            <section className="kpi-grid">
              <KpiCard label="年月" value={dashboard.kpis.latestMonth ?? "-"} sub="最新月" tone="slate" />
              <KpiCard label="売上" value={formatCurrency(dashboard.kpis.latestSales)} sub="当月合計" />
              <KpiCard label="原価" value={formatCurrency(dashboard.kpis.latestCost)} sub="当月合計" tone="rose" />
              <KpiCard label="粗利" value={formatCurrency(dashboard.kpis.latestGross)} sub="当月合計" tone="green" />
              <KpiCard label="粗利率" value={formatPercent(dashboard.kpis.profitRate)} sub="当月" tone="violet" />
              <KpiCard
                label="売上 前年同月比"
                value={formatPercent(dashboard.kpis.salesYoY)}
                sub={dashboard.kpis.salesYoY >= 0 ? "前年比 上昇" : "前年比 低下"}
                tone={dashboard.kpis.salesYoY >= 0 ? "green" : "rose"}
              />
              <KpiCard
                label="粗利 前年同月比"
                value={formatPercent(dashboard.kpis.grossYoY)}
                sub={`${latestRowCount.toLocaleString()} 件`}
                tone={dashboard.kpis.grossYoY >= 0 ? "green" : "rose"}
              />
            </section>

            <section className="chart-grid three">
              <HorizontalBars title="部門別売上" data={latestBars.departments} color="#06b6d4" />
              <HorizontalBars title="カテゴリ別売上" data={latestBars.categories} color="#818cf8" />
              <HorizontalBars title="顧客別売上 TOP3" data={latestBars.customers} color="#34d399" />
            </section>

            <LineChart
              data={trendData}
              action={
                <SelectControl
                  label="部門"
                  value={chartDept}
                  options={departments}
                  onChange={setChartDept}
                />
              }
            />

            <section className="content-block">
              <div className="section-heading block-heading">
                <div>
                  <h2>売上構成比</h2>
                  <span>年・月で絞り込み</span>
                </div>
                <div className="filter-row compact">
                  <SelectControl label="年" value={pieYear} options={years} allLabel="全年" onChange={setPieYear} />
                  <SelectControl
                    label="月"
                    value={pieMonth}
                    options={months}
                    allLabel="全月"
                    onChange={setPieMonth}
                  />
                </div>
              </div>
              <div className="chart-grid three">
                <CompositionCard title="部門別売上比率" data={composition.departments} />
                <CompositionCard title="カテゴリ別売上比率" data={composition.categories} />
                <CompositionCard title="顧客別売上比率 TOP5" data={composition.customers} />
              </div>
            </section>

            <section className="table-card">
              <div className="section-heading table-heading">
                <div>
                  <h2>売上テーブル</h2>
                  <span>
                    {filteredRows.length.toLocaleString()} 件 / 全 {rows.length.toLocaleString()} 件
                  </span>
                </div>
              </div>
              <div className="table-filters">
                <SelectControl
                  label="年"
                  value={tableYear}
                  options={years}
                  onChange={(value) => setTableFilter(setTableYear, value, true)}
                />
                <SelectControl
                  label="月"
                  value={tableMonth}
                  options={months}
                  onChange={(value) => setTableFilter(setTableMonth, value, true)}
                />
                <SelectControl
                  label="部門"
                  value={tableDept}
                  options={departments}
                  onChange={(value) => setTableFilter(setTableDept, value, true)}
                />
                <SelectControl
                  label="カテゴリ"
                  value={tableCategory}
                  options={categories}
                  onChange={(value) => setTableFilter(setTableCategory, value, true)}
                />
                <SelectControl
                  label="顧客"
                  value={tableCustomer}
                  options={tableCustomers}
                  onChange={(value) => setTableFilter(setTableCustomer, value)}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {tableColumns.map((column) => (
                        <th className={numberColumns.includes(column) ? "number-head" : ""} key={column}>
                          {column}
                        </th>
                      ))}
                      <th className="number-head">粗利率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, rowIndex) => {
                      const sales = asNumber(row["売上"]);
                      const gross = asNumber(row["粗利"]);
                      const grossRate = sales ? (gross / sales) * 100 : 0;

                      return (
                        <tr key={String(row.id ?? `${row["年月"]}-${row["顧客名"]}-${page}-${rowIndex}`)}>
                          {tableColumns.map((column) => (
                            <td className={["売上", "原価", "粗利"].includes(column) ? "number-cell" : ""} key={column}>
                              {["売上", "原価", "粗利"].includes(column)
                                ? formatCurrency(asNumber(row[column]))
                                : formatValue(row[column])}
                            </td>
                          ))}
                          <td className="number-cell accent-cell">{formatPercent(grossRate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {filteredRows.length === 0
                    ? "0 件"
                    : `${((page - 1) * pageSize + 1).toLocaleString()}-${Math.min(
                        page * pageSize,
                        filteredRows.length,
                      ).toLocaleString()} 件 / ${filteredRows.length.toLocaleString()} 件`}
                </span>
                <div className="page-controls">
                  <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    前へ
                  </button>
                  <strong>
                    {page} / {totalPages}
                  </strong>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    次へ
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
