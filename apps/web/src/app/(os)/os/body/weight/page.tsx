"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { db } from "../../../../../lib/db";
import type { BodyWeightEntry } from "../../../../../lib/db";
import { todayISO } from "../../../../../lib/date";
import {
  addWeightEntry,
  deleteWeightEntry,
  getWeightChange,
} from "../../../../../lib/weight";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateFull(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function WeightTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { dateKey: string; weightKg: number } }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div
      style={{
        background: "#0b0b0d",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
        {formatDateFull(data.dateKey)}
      </p>
      <p style={{ color: "#34d399", fontWeight: 600 }}>
        {data.weightKg.toFixed(1)} kg
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function WeightPage() {
  const pathname = usePathname();
  const today = React.useMemo(() => todayISO(), []);

  // Form state
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [weightInput, setWeightInput] = React.useState("");

  // Reactive queries — bounded to last 180 days for performance
  const chartBoundary = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 180);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const allEntries =
    useLiveQuery(
      () =>
        db.body_weight_entries
          .where("dateKey")
          .aboveOrEqual(chartBoundary)
          .sortBy("dateKey"),
      [chartBoundary],
    ) ?? ([] as BodyWeightEntry[]);

  const latestEntry = useLiveQuery(
    () => db.body_weight_entries.orderBy("dateKey").reverse().first(),
    [],
  );

  const entryForSelectedDate = useLiveQuery(
    () => db.body_weight_entries.get(selectedDate),
    [selectedDate],
  );

  // Weight change stats (not reactive via useLiveQuery since getWeightChange is async with logic)
  const [change7, setChange7] = React.useState<number | null>(null);
  const [change30, setChange30] = React.useState<number | null>(null);

  // Recompute changes when entries change
  React.useEffect(() => {
    let cancelled = false;
    async function compute() {
      const [c7, c30] = await Promise.all([
        getWeightChange(7),
        getWeightChange(30),
      ]);
      if (!cancelled) {
        setChange7(c7);
        setChange30(c30);
      }
    }
    compute();
    return () => {
      cancelled = true;
    };
  }, [allEntries]);

  // Pre-fill weight input when entry exists for selected date
  React.useEffect(() => {
    if (entryForSelectedDate) {
      setWeightInput(String(entryForSelectedDate.weightKg));
    } else {
      setWeightInput("");
    }
  }, [entryForSelectedDate]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleLogWeight() {
    const kg = parseFloat(weightInput);
    if (!Number.isFinite(kg) || kg <= 0) return;
    await addWeightEntry(selectedDate, kg);
    setWeightInput(String(kg));
  }

  async function handleDelete(dateKey: string) {
    await deleteWeightEntry(dateKey);
  }

  // ─── Derived data ────────────────────────────────────────────────────────

  // Chart data: all entries
  const chartData = React.useMemo(
    () =>
      allEntries.map((entry) => ({
        dateKey: entry.dateKey,
        weightKg: entry.weightKg,
        label: formatDateLabel(entry.dateKey),
      })),
    [allEntries],
  );

  // Recent entries for history table (last 30)
  const recentEntries = React.useMemo(() => {
    const sorted = [...allEntries].sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey),
    );
    return sorted.slice(0, 30);
  }, [allEntries]);

  // Map for computing change from previous entry in history
  const entryByDate = React.useMemo(() => {
    const map = new Map<string, BodyWeightEntry>();
    for (const entry of allEntries) {
      map.set(entry.dateKey, entry);
    }
    return map;
  }, [allEntries]);

  function getChangeFromPrevious(entry: BodyWeightEntry): number | null {
    const sortedKeys = allEntries.map((e) => e.dateKey).sort();
    const idx = sortedKeys.indexOf(entry.dateKey);
    if (idx <= 0) return null;
    const prevKey = sortedKeys[idx - 1];
    const prevEntry = entryByDate.get(prevKey);
    if (!prevEntry) return null;
    return entry.weightKg - prevEntry.weightKg;
  }

  function formatChange(value: number | null): React.ReactNode {
    if (value === null) return <span className="tp-muted">--</span>;
    const sign = value > 0 ? "+" : "";
    const color = value < 0 ? "#34d399" : value > 0 ? "#f87171" : "rgba(255,255,255,0.5)";
    return (
      <span style={{ color, fontWeight: 600 }}>
        {sign}
        {value.toFixed(1)} kg
      </span>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <header>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">BODY ENGINE</h1>
        <p className="tp-subtitle mt-3 text-sm text-white/70">
          Weight Tracker
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <div className="tp-tabs">
          <Link
            href="/os/body"
            className={`tp-tab ${pathname === "/os/body" ? "is-active" : ""}`}
          >
            Body Engine
          </Link>
          <Link
            href="/os/body/nutrition"
            className={`tp-tab ${pathname?.startsWith("/os/body/nutrition") ? "is-active" : ""}`}
          >
            Nutrition
          </Link>
          <Link
            href="/os/body/workouts"
            className={`tp-tab ${pathname?.startsWith("/os/body/workouts") ? "is-active" : ""}`}
          >
            Workouts
          </Link>
          <Link
            href="/os/body/weight"
            className={`tp-tab ${pathname?.startsWith("/os/body/weight") ? "is-active" : ""}`}
          >
            Weight
          </Link>
        </div>
      </div>

      {/* Weight Entry Form */}
      <section className="tp-panel mt-6 p-5 sm:p-6">
        <div className="tp-panel-head">
          <p className="tp-kicker">Log Weight</p>
          {entryForSelectedDate ? (
            <p className="tp-muted">
              Logged: {entryForSelectedDate.weightKg.toFixed(1)} kg
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="body-label">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="body-input"
            />
          </div>
          <div>
            <label className="body-label">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="e.g. 75.5"
              className="body-input"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleLogWeight}
              className="tp-button mt-0 w-auto px-6"
              disabled={
                !weightInput ||
                !Number.isFinite(parseFloat(weightInput)) ||
                parseFloat(weightInput) <= 0
              }
            >
              Log Weight
            </button>
          </div>
        </div>
      </section>

      {/* Weight Graph */}
      <section className="tp-panel mt-6 p-5 sm:p-6">
        <p className="tp-kicker">Weight Trend</p>
        {chartData.length === 0 ? (
          <div className="body-empty mt-4">
            No weight entries yet. Log your first weight above.
          </div>
        ) : (
          <div className="mt-4" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value} kg`}
                  width={60}
                />
                <Tooltip content={<WeightTooltip />} />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#34d399", stroke: "#34d399" }}
                  activeDot={{ r: 5, fill: "#34d399", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Stats Panel */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {/* Current Weight */}
        <section className="tp-panel p-5">
          <p className="tp-kicker">Current Weight</p>
          {latestEntry ? (
            <>
              <p className="tp-score-value mt-2 text-2xl">
                {latestEntry.weightKg.toFixed(1)}{" "}
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                  kg
                </span>
              </p>
              <p className="tp-muted mt-1">{formatDateFull(latestEntry.dateKey)}</p>
            </>
          ) : (
            <p className="tp-muted mt-2">No entries</p>
          )}
        </section>

        {/* 7-Day Change */}
        <section className="tp-panel p-5">
          <p className="tp-kicker">7-Day Change</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatChange(change7)}
          </p>
          <p className="tp-muted mt-1">Last 7 days</p>
        </section>

        {/* 30-Day Change */}
        <section className="tp-panel p-5">
          <p className="tp-kicker">30-Day Change</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatChange(change30)}
          </p>
          <p className="tp-muted mt-1">Last 30 days</p>
        </section>
      </div>

      {/* Weight History Table */}
      <section className="tp-panel mt-6 p-5 sm:p-6">
        <div className="tp-panel-head">
          <p className="tp-kicker">Weight History</p>
          <p className="tp-muted">Last 30 entries</p>
        </div>

        {recentEntries.length === 0 ? (
          <div className="body-empty mt-4">No entries logged yet.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {recentEntries.map((entry) => {
              const change = getChangeFromPrevious(entry);
              return (
                <div key={entry.dateKey} className="body-task-row">
                  <div className="flex items-center gap-4">
                    <span
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.6)",
                        minWidth: 100,
                      }}
                    >
                      {formatDateFull(entry.dateKey)}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      {entry.weightKg.toFixed(1)} kg
                    </span>
                    <span style={{ fontSize: 12 }}>
                      {formatChange(change)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.dateKey)}
                    className="tp-button tp-button-inline"
                    style={{ color: "#f87171" }}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
