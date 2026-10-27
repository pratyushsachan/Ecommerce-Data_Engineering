"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type Dashboard = {
  gold_daily_revenue: DailyRow[];
  gold_category_summary: CategoryRow[];
  pipeline_status: PipelineStatus;
};

const REGIONS = ["All", "North", "South", "East", "West"];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState("All");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(String(err)));
  }, []);

  const daily = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const row of data.gold_daily_revenue) {
      if (region !== "All" && row.region !== region) continue;
      const date = row.order_date.slice(0, 10);
      const entry = byDate.get(date) ?? { date, revenue: 0, orders: 0 };
      entry.revenue += row.revenue;
      entry.orders += row.order_count;
      byDate.set(date, entry);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, region]);

  if (error) {
    return (
      <main className="wrap">
        <p>Could not load dashboard data: {error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="wrap">
        <p>Loading…</p>
      </main>
    );
  }

  const status = data.pipeline_status;
  const totalRevenue = daily.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = daily.reduce((sum, d) => sum + d.orders, 0);
  const allTestsPass = Object.values(status.tests).every((n) => n === 0);

  return (
    <main className="wrap">
      <header>
        <h1>E-commerce analytics</h1>
        <p className="muted">
          Last pipeline run: {new Date(status.ran_at).toLocaleString()}
        </p>
      </header>

      <label>
        Region{" "}
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>

      <section className="tiles">
        <Tile label="Revenue (completed)" value={fmt(totalRevenue)} />
        <Tile label="Completed orders" value={fmt(totalOrders)} />
        <Tile label="Rows removed in cleaning" value={fmt(status.rows_removed)} />
        <Tile label="Data quality checks" value={allTestsPass ? "All passing" : "Failing"} />
      </section>

      <section className="card">
        <h2>Daily revenue</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={40} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#2563eb" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Revenue by category (all regions)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.gold_category_summary}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Categories</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Completed orders</th>
              <th>Revenue</th>
              <th>Return rate</th>
            </tr>
          </thead>
          <tbody>
            {data.gold_category_summary.map((c) => (
              <tr key={c.category}>
                <td>{c.category}</td>
                <td>{fmt(c.completed_orders)}</td>
                <td>{fmt(c.revenue)}</td>
                <td>{(c.return_rate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Pipeline checks</h2>
        <ul>
          {Object.entries(status.tests).map(([name, failing]) => (
            <li key={name}>
              {name}: {failing === 0 ? "pass" : `${failing} failing rows`}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <div className="muted">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
