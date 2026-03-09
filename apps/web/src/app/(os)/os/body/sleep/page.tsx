"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/date";
import {
  addSleepEntry,
  deleteSleepEntry,
  getSleepStats,
  computeDuration,
} from "@/lib/sleep";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatDateShort(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const QUALITY_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const QUALITY_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#34d399", "#22d3ee"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SleepPage() {
  const today = React.useMemo(() => todayISO(), []);

  // ── Form state ────────────────────────────────────────────────────────────
  const [bedtime, setBedtime] = React.useState("23:00");
  const [wakeTime, setWakeTime] = React.useState("07:00");
  const [quality, setQuality] = React.useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = React.useState("");
  const [dateKey, setDateKey] = React.useState(today);

  // ── Data subscriptions ────────────────────────────────────────────────────
  const entries = useLiveQuery(
    () => db.sleep_entries.orderBy("dateKey").reverse().limit(30).toArray(),
    [],
  );

  const stats = useLiveQuery(() => getSleepStats(7), []) ?? null;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = React.useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .reverse()
      .slice(-14)
      .map((e) => ({
        dateKey: formatDateShort(e.dateKey),
        hours: Math.round((e.durationMinutes / 60) * 10) / 10,
        quality: e.quality,
      }));
  }, [entries]);

  // ── Auto-calculate duration ───────────────────────────────────────────────
  const duration = React.useMemo(
    () => computeDuration(bedtime, wakeTime),
    [bedtime, wakeTime],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSave() {
    await addSleepEntry({
      dateKey,
      bedtime,
      wakeTime,
      durationMinutes: duration,
      quality,
      notes: notes.trim(),
    });
    setNotes("");
  }

  async function handleDelete(dk: string) {
    await deleteSleepEntry(dk);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <header>
        <p className="tp-kicker">Body Engine</p>
        <h1 className="tp-title">Sleep Tracker</h1>
        <p className="tp-subtitle mt-1">
          Track your sleep patterns and optimize recovery.
        </p>
      </header>

      {/* Stats cards */}
      {stats && stats.totalEntries > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Avg Duration</p>
            <p className="tp-score-value mt-1 text-xl">
              {formatDuration(stats.avgDuration)}
            </p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Avg Quality</p>
            <p className="tp-score-value mt-1 text-xl">
              {stats.avgQuality}
              <span className="text-sm text-white/40">/5</span>
            </p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Avg Bedtime</p>
            <p className="tp-score-value mt-1 text-xl">{stats.avgBedtime}</p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Avg Wake</p>
            <p className="tp-score-value mt-1 text-xl">{stats.avgWakeTime}</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        {/* Log form */}
        <section className="tp-panel p-5">
          <p className="tp-kicker mb-4">Log Sleep</p>

          <div className="space-y-4">
            <div>
              <label className="body-label">Date</label>
              <input
                type="date"
                className="body-input"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="body-label">Bedtime</label>
                <input
                  type="time"
                  className="body-input"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                />
              </div>
              <div>
                <label className="body-label">Wake Time</label>
                <input
                  type="time"
                  className="body-input"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="body-label">
                Duration:{" "}
                <span className="text-[#34d399] font-semibold">
                  {formatDuration(duration)}
                </span>
              </label>
            </div>

            <div>
              <label className="body-label">Quality</label>
              <div className="flex gap-2 mt-1">
                {([1, 2, 3, 4, 5] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all"
                    style={{
                      border:
                        quality === q
                          ? `1px solid ${QUALITY_COLORS[q]}80`
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        quality === q
                          ? `${QUALITY_COLORS[q]}15`
                          : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span className="text-lg">{q}</span>
                    <span className="text-[9px] text-white/50">
                      {QUALITY_LABELS[q]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="body-label">Notes</label>
              <textarea
                className="body-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did you sleep?"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="tp-button w-full"
            >
              Save Entry
            </button>
          </div>
        </section>

        {/* Chart */}
        <section className="tp-panel p-5">
          <p className="tp-kicker mb-4">Sleep Duration (last 14 days)</p>
          {chartData.length === 0 ? (
            <div className="body-empty">
              No sleep data yet. Log your first night to see trends.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="dateKey"
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                />
                <YAxis
                  domain={[0, 12]}
                  stroke="rgba(255,255,255,0.3)"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                  unit="h"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ fill: "#34d399", r: 3 }}
                  name="Hours"
                />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Quality"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* History */}
      <section className="mt-6 tp-panel p-5">
        <p className="tp-kicker mb-4">Recent Entries</p>
        {!entries || entries.length === 0 ? (
          <div className="body-empty">No entries yet.</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.dateKey} className="body-task-row">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      {entry.dateKey}
                    </p>
                    <p className="text-xs text-white/50">
                      {entry.bedtime} → {entry.wakeTime} •{" "}
                      {formatDuration(entry.durationMinutes)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: QUALITY_COLORS[entry.quality] }}
                  >
                    {QUALITY_LABELS[entry.quality]}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.dateKey)}
                    className="text-white/30 hover:text-red-400 transition-colors text-xs"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
