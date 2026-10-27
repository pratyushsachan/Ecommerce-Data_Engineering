"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dailyRaw from "../data/gold_daily_revenue.json";
import categoryRaw from "../data/gold_category_summary.json";
import statusRaw from "../data/pipeline_status.json";

/* ---------- Types and data ---------- */

type DailyRow = {
  order_date: string;
  region: string;
  order_count: number;
  revenue: number;
};

type CategoryRow = {
  category: string;
  completed_orders: number;
  revenue: number;
  return_rate: number;
};

type PipelineStatus = {
  ran_at: string;
  bronze_orders: number;
  silver_orders: number;
  rows_removed: number;
  tests: Record<string, number>;
};

const daily = dailyRaw as DailyRow[];
const categories = categoryRaw as CategoryRow[];
const status = statusRaw as PipelineStatus;

const REGIONS = ["All", "North", "South", "East", "West"] as const;
const GRANULARITIES = ["Daily", "Weekly", "Monthly"] as const;
const SORTS = ["Revenue", "Return rate"] as const;

type Region = (typeof REGIONS)[number];
type Gran = (typeof GRANULARITIES)[number];
type SortKey = (typeof SORTS)[number];

const GITHUB_URL = "https://github.com/pratyushsachan/Ecommerce-Data_Engineering";

/* ---------- Pipeline content ---------- */

const STAGES = [
  {
    key: "bronze",
    layer: "bronze",
    name: "Bronze",
    text: "Raw order, customer, and product files are loaded exactly as they arrive. Nothing is changed, so any later step can be rerun from here.",
    code: `CREATE TABLE bronze_orders AS
SELECT *, current_timestamp AS _loaded_at
FROM read_csv_auto('orders.csv');`,
  },
  {
    key: "silver",
    layer: "silver",
    name: "Silver",
    text: "Duplicate orders, negative quantities, and orders with no customer are removed. Each order gets its product price, category, and region.",
    code: `SELECT DISTINCT ON (order_id) *
FROM bronze_orders
WHERE quantity > 0
  AND customer_id IS NOT NULL;`,
  },
  {
    key: "tests",
    layer: "plain",
    name: "Quality checks",
    text: "Four checks run on the cleaned data. If any one fails, the pipeline stops and the dashboard keeps its last good numbers.",
    code: `-- A check passes when it returns zero rows
SELECT order_id, COUNT(*)
FROM silver_orders
GROUP BY order_id
HAVING COUNT(*) > 1;`,
  },
  {
    key: "gold",
    layer: "gold",
    name: "Gold",
    text: "Business-ready tables: daily revenue by region, and a summary of revenue and returns by product category.",
    code: `SELECT order_date, region,
       COUNT(*) AS order_count,
       ROUND(SUM(revenue), 2) AS revenue
FROM silver_orders
WHERE status = 'completed'
GROUP BY order_date, region;`,
  },
  {
    key: "dashboard",
    layer: "plain",
    name: "Dashboard",
    text: "The gold tables are exported as JSON and drawn on this page. Everything below comes from that export.",
    code: `df = con.execute("SELECT * FROM gold_daily_revenue").df()
df.to_json("web/data/gold_daily_revenue.json",
           orient="records")`,
  },
] as const;

const CHECKS: Record<string, { title: string; plain: string; sql: string }> = {
  "01_unique_order_id": {
    title: "No duplicate orders",
    plain: "Every order ID appears once",
    sql: `SELECT order_id, COUNT(*) AS n
FROM silver_orders
GROUP BY order_id
HAVING COUNT(*) > 1;`,
  },
  "02_positive_quantity": {
    title: "Quantities make sense",
    plain: "Every quantity is above zero",
    sql: `SELECT order_id, quantity
FROM silver_orders
WHERE quantity <= 0;`,
  },
  "03_customer_exists": {
    title: "Every order has a customer",
    plain: "No orders point to a missing customer",
    sql: `SELECT o.order_id
FROM silver_orders o
LEFT JOIN silver_customers c
  ON c.customer_id = o.customer_id
WHERE c.customer_id IS NULL;`,
  },
  "04_revenue_present": {
    title: "Every order has revenue",
    plain: "No order is missing a price",
    sql: `SELECT order_id
FROM silver_orders
WHERE revenue IS NULL;`,
  },
};

const STACK = [
  "Python",
  "DuckDB",
  "SQL",
  "pandas",
  "GitHub Actions",
  "Next.js",
  "React",
  "Recharts",
  "Vercel",
];

/* ---------- Helpers ---------- */

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtMoney = (n: number) => `$${fmtInt(n)}`;

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function bucketKey(dateStr: string, g: Gran) {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00Z");
  if (g === "Daily") return d.toISOString().slice(0, 10);
  if (g === "Monthly") return d.toISOString().slice(0, 7) + "-01";
  const offset = (d.getUTCDay() + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function labelFor(key: string, g: Gran, long = false) {
  const d = new Date(key + "T00:00:00Z");
  if (g === "Monthly") {
    return d.toLocaleDateString("en-GB", {
      month: "short",
      year: long ? "numeric" : "2-digit",
      timeZone: "UTC",
    });
  }
  const text = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
  return g === "Weekly" && long ? `Week of ${text}` : text;
}

/** Animates a number from its previous value to a new target. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    if (prefersReduced()) {
      previous.current = target;
      setValue(target);
      return;
    }
    const from = previous.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      previous.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

/* ---------- Small components ---------- */

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const style = { "--n": options.length, "--i": options.indexOf(value) } as CSSProperties;
  return (
    <div className="seg" role="group" aria-label={label} style={style}>
      <span className="seg-ind" aria-hidden="true" />
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);

const ChevronIcon = () => (
  <svg className="chev" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 8l5 5 5-5" />
  </svg>
);

/* ---------- Pipeline ---------- */

function Pipeline() {
  const [reached, setReached] = useState(0);
  const [selected, setSelected] = useState(0);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const run = useCallback(() => {
    clear();
    if (prefersReduced()) {
      setReached(STAGES.length);
      setSelected(STAGES.length - 1);
      return;
    }
    setRunning(true);
    setReached(0);
    setSelected(0);
    STAGES.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setReached(i + 1);
          setSelected(i);
          if (i === STAGES.length - 1) setRunning(false);
        }, 600 + i * 900)
      );
    });
  }, []);

  useEffect(() => {
    run();
    return clear;
  }, [run]);

  const total = Object.keys(status.tests).length;
  const passed = Object.values(status.tests).filter((n) => n === 0).length;
  const metrics = [
    `${fmtInt(status.bronze_orders)} raw orders`,
    `${fmtInt(status.rows_removed)} removed, ${fmtInt(status.silver_orders)} kept`,
    `${passed} of ${total} checks pass`,
    "2 tables built",
    "You are looking at it",
  ];

  const progress = reached <= 1 ? 0 : (reached - 1) / (STAGES.length - 1);
  const current = STAGES[selected];

  return (
    <>
      <div className="hero-actions">
        <button type="button" className="btn btn-primary" onClick={run} disabled={running}>
          {running ? (
            <>
              <span className="spin" aria-hidden="true" /> Running
            </>
          ) : (
            "Run the pipeline again"
          )}
        </button>
        <a className="btn" href={GITHUB_URL} target="_blank" rel="noreferrer">
          View the code on GitHub
        </a>
      </div>

      <div className="pipeline">
        <div className="track" style={{ "--p": progress } as CSSProperties}>
          <div className="track-line" aria-hidden="true">
            <div className="track-fill" />
          </div>
          {STAGES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className="stage"
              data-layer={s.layer}
              data-done={reached > i}
              aria-current={selected === i}
              onClick={() => setSelected(i)}
            >
              <span className="node">{reached > i ? <CheckIcon /> : i + 1}</span>
              <span className="label-col">
                <span className="name">{s.name}</span>
                <span className="metric">{metrics[i]}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="detail" aria-live="polite">
          <div className="detail-body" key={current.key}>
            <div>
              <h3>{current.name}</h3>
              <p>{current.text}</p>
            </div>
            <pre>{current.code}</pre>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Sales ---------- */

function Sales() {
  const [region, setRegion] = useState<Region>("All");
  const [gran, setGran] = useState<Gran>("Weekly");

  const totals = useMemo(() => {
    let revenue = 0;
    let orders = 0;
    for (const r of daily) {
      if (region !== "All" && r.region !== region) continue;
      revenue += r.revenue;
      orders += r.order_count;
    }
    return { revenue, orders, average: orders ? revenue / orders : 0 };
  }, [region]);

  const series = useMemo(() => {
    const map = new Map<string, { key: string; revenue: number; orders: number }>();
    for (const r of daily) {
      if (region !== "All" && r.region !== region) continue;
      const key = bucketKey(r.order_date, gran);
      const entry = map.get(key) ?? { key, revenue: 0, orders: 0 };
      entry.revenue += r.revenue;
      entry.orders += r.order_count;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [region, gran]);

  const revenue = useCountUp(totals.revenue);
  const orders = useCountUp(totals.orders);
  const average = useCountUp(totals.average);

  return (
    <section className="section" aria-labelledby="sales-h">
      <div className="section-head">
        <div>
          <h2 id="sales-h">Sales</h2>
          <p>Completed orders only. Pick a region and the numbers and chart update.</p>
        </div>
        <Segmented options={REGIONS} value={region} onChange={setRegion} label="Region" />
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="label">Revenue</div>
          <div className="value">{fmtMoney(revenue)}</div>
        </div>
        <div className="kpi">
          <div className="label">Completed orders</div>
          <div className="value">{fmtInt(orders)}</div>
        </div>
        <div className="kpi">
          <div className="label">Average order</div>
          <div className="value">{fmtMoney(average)}</div>
        </div>
      </div>

      <div className="chart-wrap">
        <div className="chart-head">
          <h3>Revenue over time</h3>
          <Segmented options={GRANULARITIES} value={gran} onChange={setGran} label="Time grouping" />
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
                  <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="key"
                tickFormatter={(k: string) => labelFor(k, gran)}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
              />
              <YAxis
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { key: string; revenue: number; orders: number };
                  return (
                    <div className="tip">
                      <div className="tip-date">{labelFor(p.key, gran, true)}</div>
                      <div className="tip-val">{fmtMoney(p.revenue)}</div>
                      <div>{fmtInt(p.orders)} orders</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#fillRevenue)"
                activeDot={{ r: 6, stroke: "var(--surface)", strokeWidth: 2 }}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-note">
          {gran === "Daily" ? "" : "The most recent period may be incomplete."}
        </p>
      </div>
    </section>
  );
}

/* ---------- Categories ---------- */

function Categories() {
  const [sort, setSort] = useState<SortKey>("Revenue");
  const [hovered, setHovered] = useState<string | null>(null);

  const valueOf = (c: CategoryRow) => (sort === "Revenue" ? c.revenue : c.return_rate);
  const ranked = useMemo(
    () => [...categories].sort((a, b) => valueOf(b) - valueOf(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort]
  );
  const max = Math.max(...categories.map(valueOf));

  return (
    <section className="section" aria-labelledby="cat-h">
      <div className="section-head">
        <div>
          <h2 id="cat-h">Sales by product category</h2>
          <p>All regions. Switch the sort to see which categories earn the most and which get returned the most.</p>
        </div>
        <Segmented options={SORTS} value={sort} onChange={setSort} label="Sort categories by" />
      </div>

      <div className="cats" style={{ "--n": categories.length } as CSSProperties}>
        {categories.map((c) => {
          const rank = ranked.findIndex((r) => r.category === c.category);
          const share = max ? valueOf(c) / max : 0;
          return (
            <div
              key={c.category}
              className="cat"
              tabIndex={0}
              style={{ "--rank": rank, "--w": `${Math.max(share * 100, 2)}%` } as CSSProperties}
              data-active={hovered === c.category}
              data-dim={hovered !== null && hovered !== c.category}
              onMouseEnter={() => setHovered(c.category)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(c.category)}
              onBlur={() => setHovered(null)}
            >
              <span className="cat-name">{c.category}</span>
              <span className="bar-track">
                <span className="bar" style={{ display: "block" }} />
              </span>
              <span className="vals">
                {sort === "Revenue" ? (
                  <>
                    <strong>{fmtMoney(c.revenue)}</strong>
                    <span>{(c.return_rate * 100).toFixed(1)}% returned</span>
                  </>
                ) : (
                  <>
                    <strong>{(c.return_rate * 100).toFixed(1)}% returned</strong>
                    <span>{fmtMoney(c.revenue)} revenue</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Quality checks ---------- */

function Checks() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="section" aria-labelledby="chk-h">
      <div className="section-head">
        <div>
          <h2 id="chk-h">Four checks guard the data</h2>
          <p>Each check is a query that should return no rows. Open one to see the query.</p>
        </div>
      </div>

      <div className="checks">
        {Object.entries(status.tests).map(([key, failing]) => {
          const info = CHECKS[key] ?? { title: key, plain: "", sql: "" };
          const isOpen = open === key;
          return (
            <div className="check" key={key} data-open={isOpen}>
              <button
                type="button"
                className="check-btn"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : key)}
              >
                <span className="tick">
                  <CheckIcon />
                </span>
                <span className="t">
                  <strong>{info.title}</strong>
                  <span>
                    {failing === 0 ? "Passing" : `${failing} rows failing`}. {info.plain}
                  </span>
                </span>
                <ChevronIcon />
              </button>
              <div className="check-body">
                <div className="check-inner">
                  <pre>{info.sql}</pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

export default function Home() {
  const ran = new Date(status.ran_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="page">
      <header className="hero">
        <h1>From raw orders to a tested sales dashboard</h1>
        <p className="lede">
          A data pipeline that cleans messy order files, checks them with automated tests, and
          builds the tables behind this page. Press run to watch each stage.
        </p>
        <p className="byline">A portfolio project by Pratyush Sachan. Last pipeline run: {ran}.</p>
        <Pipeline />
      </header>

      <Sales />
      <Categories />
      <Checks />

      <section className="section" aria-labelledby="stack-h">
        <div className="section-head">
          <div>
            <h2 id="stack-h">Built with</h2>
          </div>
        </div>
        <div className="stack">
          {STACK.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <p className="foot-note">
          The order data is synthetic. It was generated with deliberate problems, such as duplicate
          orders and negative quantities, so the cleaning and quality checks have real work to do.
        </p>
      </section>
    </main>
  );
}
