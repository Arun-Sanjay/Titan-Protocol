"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Habit, HabitLog } from "@/lib/db";
import { todayISO } from "@/lib/date";
import {
  listHabits,
  addHabit,
  deleteHabit,
  toggleHabitForDate,
  getHabitLogsForRange,
  getHabitStreak,
  getBestStreak,
} from "@/lib/habits";
import HabitGrid from "@/components/habits/HabitGrid";
import type { HabitGridCell } from "@/components/habits/HabitGrid";

// ---- helpers ----

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function subtractDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() - n);
  return dateToISO(d);
}

const ENGINE_OPTIONS: { value: Habit["engine"]; label: string }[] = [
  { value: "body", label: "Body" },
  { value: "mind", label: "Mind" },
  { value: "money", label: "Money" },
  { value: "general", label: "General" },
  { value: "all", label: "All" },
];

const ENGINE_COLORS: Record<Habit["engine"], string> = {
  body: "#f87171",
  mind: "#60a5fa",
  money: "#34d399",
  general: "#a78bfa",
  all: "#fbbf24",
};

// ---- component ----

export default function HabitsPage() {
  const today = React.useMemo(() => todayISO(), []);
  const gridStart = React.useMemo(() => subtractDays(today, 12 * 7 - 1), [today]);

  // ---- data subscriptions ----
  const habits = useLiveQuery(() => listHabits(), []);
  const todayLogs = useLiveQuery(
    () =>
      db.habit_logs
        .where("dateKey")
        .equals(today)
        .toArray(),
    [today],
  );
  const rangeLogs = useLiveQuery(
    () => getHabitLogsForRange(gridStart, today),
    [gridStart, today],
  );

  // ---- streaks (computed on change) ----
  const [streaks, setStreaks] = React.useState<
    Map<number, { current: number; best: number }>
  >(new Map());

  React.useEffect(() => {
    if (!habits || habits.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = new Map<number, { current: number; best: number }>();
      for (const h of habits) {
        const id = h.id!;
        const [current, best] = await Promise.all([
          getHabitStreak(id),
          getBestStreak(id),
        ]);
        map.set(id, { current, best });
      }
      if (!cancelled) setStreaks(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [habits, todayLogs]);

  // ---- today's completions set ----
  const completedToday = React.useMemo(() => {
    const set = new Set<number>();
    if (todayLogs) {
      for (const log of todayLogs) {
        if (log.completed) set.add(log.habitId);
      }
    }
    return set;
  }, [todayLogs]);

  // ---- grid data per habit ----
  const gridDataMap = React.useMemo(() => {
    const map = new Map<number, HabitGridCell[]>();
    if (!habits || !rangeLogs) return map;

    // Build per-habit log lookup
    const habitLogMap = new Map<number, Map<string, boolean>>();
    for (const log of rangeLogs) {
      if (!habitLogMap.has(log.habitId)) {
        habitLogMap.set(log.habitId, new Map());
      }
      habitLogMap.get(log.habitId)!.set(log.dateKey, log.completed);
    }

    for (const h of habits) {
      const id = h.id!;
      const cells: HabitGridCell[] = [];
      const logLookup = habitLogMap.get(id);
      const totalDays = 12 * 7;
      for (let i = 0; i < totalDays; i++) {
        const dateKey = subtractDays(today, totalDays - 1 - i);
        const completed = logLookup?.get(dateKey) ?? false;
        cells.push({
          dateKey,
          count: completed ? 1 : 0,
          max: 1,
        });
      }
      map.set(id, cells);
    }

    return map;
  }, [habits, rangeLogs, today]);

  // ---- aggregate grid data (all habits combined) ----
  const aggregateGridData = React.useMemo(() => {
    if (!habits || habits.length === 0 || !rangeLogs) return [];

    const dayMap = new Map<string, number>();
    for (const log of rangeLogs) {
      if (log.completed) {
        dayMap.set(log.dateKey, (dayMap.get(log.dateKey) ?? 0) + 1);
      }
    }

    const totalDays = 12 * 7;
    const max = habits.length;
    const cells: HabitGridCell[] = [];
    for (let i = 0; i < totalDays; i++) {
      const dateKey = subtractDays(today, totalDays - 1 - i);
      cells.push({
        dateKey,
        count: dayMap.get(dateKey) ?? 0,
        max,
      });
    }
    return cells;
  }, [habits, rangeLogs, today]);

  // ---- modal state ----
  const [showModal, setShowModal] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newEngine, setNewEngine] = React.useState<Habit["engine"]>("general");
  const [newIcon, setNewIcon] = React.useState("");

  // ---- delete confirm ----
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  // ---- handlers ----

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    await addHabit(title, newEngine, newIcon || "~");
    setNewTitle("");
    setNewEngine("general");
    setNewIcon("");
    setShowModal(false);
  }

  async function handleToggle(habitId: number) {
    await toggleHabitForDate(habitId, today);
  }

  async function handleDelete(habitId: number) {
    await deleteHabit(habitId);
    setDeletingId(null);
  }

  // ---- loading ----
  if (habits === undefined) {
    return (
      <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
        <p className="tp-muted">Loading habits...</p>
      </main>
    );
  }

  const completedCount = completedToday.size;
  const totalCount = habits.length;

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <header>
        <p className="tp-kicker">Discipline System</p>
        <h1 className="tp-title">Habits</h1>
        <p className="tp-subtitle mt-1">
          {totalCount === 0
            ? "No habits tracked yet — add one to start building your streak."
            : `${completedCount} of ${totalCount} completed today`}
        </p>
      </header>

      {/* Quick stats */}
      {totalCount > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Today</p>
            <p className="tp-score-value mt-1 text-2xl">
              {completedCount}
              <span className="text-base text-white/50">/{totalCount}</span>
            </p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Rate</p>
            <p className="tp-score-value mt-1 text-2xl">
              {totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0}
              <span className="text-base text-white/50">%</span>
            </p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Best Streak</p>
            <p className="tp-score-value mt-1 text-2xl">
              {Math.max(
                0,
                ...Array.from(streaks.values()).map((s) => s.best),
              )}
              <span className="text-base text-white/50">d</span>
            </p>
          </div>
          <div className="tp-panel p-4 text-center">
            <p className="tp-kicker">Tracking</p>
            <p className="tp-score-value mt-1 text-2xl">{totalCount}</p>
          </div>
        </div>
      )}

      {/* Overall contribution grid */}
      {totalCount > 0 && aggregateGridData.length > 0 && (
        <section className="tp-panel mt-6 p-5">
          <p className="tp-kicker mb-3">Activity / Last 12 Weeks</p>
          <HabitGrid logs={aggregateGridData} weeks={12} />
        </section>
      )}

      {/* Habit list */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="tp-kicker">Your Habits</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="tp-button tp-button-inline"
          >
            + Add Habit
          </button>
        </div>

        {habits.length === 0 && (
          <div className="body-empty">
            No habits yet. Click &quot;+ Add Habit&quot; to start tracking.
          </div>
        )}

        <div className="grid gap-3">
          {habits.map((habit) => {
            const id = habit.id!;
            const done = completedToday.has(id);
            const streak = streaks.get(id);
            const gridData = gridDataMap.get(id) ?? [];

            return (
              <div
                key={id}
                className="tp-panel p-4"
              >
                {/* Habit header row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Toggle checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(id)}
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: done
                          ? "1px solid rgba(52, 211, 153, 0.5)"
                          : "1px solid rgba(255,255,255,0.12)",
                        background: done
                          ? "rgba(52, 211, 153, 0.15)"
                          : "rgba(255,255,255,0.03)",
                        transition: "all 150ms ease",
                      }}
                      title={done ? "Mark incomplete" : "Mark complete"}
                    >
                      {done && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            d="M3 7.5L5.5 10L11 4"
                            stroke="#34d399"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Icon + title */}
                    <span className="text-lg">{habit.icon}</span>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium text-white/90 truncate"
                        style={{
                          textDecoration: done ? "line-through" : "none",
                          opacity: done ? 0.6 : 1,
                        }}
                      >
                        {habit.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium"
                          style={{
                            backgroundColor: `${ENGINE_COLORS[habit.engine]}20`,
                            color: ENGINE_COLORS[habit.engine],
                            border: `1px solid ${ENGINE_COLORS[habit.engine]}30`,
                          }}
                        >
                          {habit.engine}
                        </span>
                        {streak && (
                          <span className="text-[10px] text-white/40 tracking-wide uppercase">
                            {streak.current}d streak
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Streak + delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    {streak && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-white/50">
                          Current:{" "}
                          <span className="text-white/80 font-semibold">
                            {streak.current}
                          </span>
                        </p>
                        <p className="text-xs text-white/50">
                          Best:{" "}
                          <span className="text-white/80 font-semibold">
                            {streak.best}
                          </span>
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeletingId(id)}
                      className="text-white/30 hover:text-red-400 transition-colors text-sm"
                      title="Delete habit"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M4 4L12 12M12 4L4 12"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Per-habit grid */}
                {gridData.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <HabitGrid logs={gridData} weeks={12} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Add Habit Modal */}
      {showModal && (
        <div
          className="body-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="body-modal-panel">
            <p className="tp-kicker mb-1">New Habit</p>
            <h2 className="text-lg font-semibold text-white/90 mb-4">
              Add a Habit to Track
            </h2>

            <div className="grid gap-4">
              {/* Title */}
              <div>
                <label className="body-label">Habit Name</label>
                <input
                  type="text"
                  className="body-input"
                  placeholder="e.g. Meditate 10 minutes"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  autoFocus
                />
              </div>

              {/* Engine */}
              <div>
                <label className="body-label">Engine</label>
                <select
                  className="body-select"
                  value={newEngine}
                  onChange={(e) =>
                    setNewEngine(e.target.value as Habit["engine"])
                  }
                >
                  {ENGINE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Icon */}
              <div>
                <label className="body-label">Icon (emoji)</label>
                <input
                  type="text"
                  className="body-input"
                  placeholder="e.g. ..."
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  maxLength={4}
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                className="tp-button inline-flex w-auto px-5"
                disabled={!newTitle.trim()}
              >
                Add Habit
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="tp-button tp-button-inline inline-flex w-auto px-5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div
          className="body-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingId(null);
          }}
        >
          <div className="body-modal-panel">
            <p className="tp-kicker mb-1">Confirm Delete</p>
            <h2 className="text-lg font-semibold text-white/90 mb-2">
              Delete this habit?
            </h2>
            <p className="text-sm text-white/50 mb-5">
              This will permanently remove the habit and all its completion
              history. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="tp-button inline-flex w-auto px-5"
                style={{
                  borderColor: "rgba(248, 113, 113, 0.3)",
                  color: "#f87171",
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="tp-button tp-button-inline inline-flex w-auto px-5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
