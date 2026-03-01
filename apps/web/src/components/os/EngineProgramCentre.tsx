"use client";

import * as React from "react";
import Link from "next/link";

import { db, type EngineName, type OSProgramRecord, type OSProgramTaskRecord } from "../../lib/db";
import { addDaysISO, diffDaysISO, toISODateLocal } from "../../lib/date";
import {
  addTask,
  getDayTaskStats,
  getTaskCompletionMapForDate,
  listProgramTasks,
  toggleTaskComplete,
} from "../../lib/tasks";
import {
  createProgram,
  endProgram,
  extendProgram,
  getActiveProgram,
  getProgramTimeline,
} from "../../lib/program";
import { getWindow, getWindowSquares, getProgramAverageConsistency } from "../../lib/analytics";

const ENGINE_TITLE: Record<EngineName, string> = {
  body: "Body",
  mind: "Mind",
  money: "Money",
  general: "General",
};

const TOOL_LINK: Partial<Record<EngineName, { href: string; label: string }>> = {
  body: { href: "/os/body/nutrition", label: "Nutrition" },
  mind: { href: "/os/mind/focus", label: "Focus Tool" },
  money: { href: "/os/money/skill", label: "Skill Tool" },
};

function todayIso(): string {
  return toISODateLocal(new Date());
}

function defaultTasks(engine: EngineName): Array<{ title: string; kind: string; isLocked: boolean }> {
  if (engine === "money") {
    return [
      { title: "30+ minutes skill work", kind: "skill", isLocked: true },
      { title: "Review spending", kind: "finance", isLocked: true },
      { title: "Ship one high-impact task", kind: "execution", isLocked: false },
    ];
  }
  if (engine === "general") {
    return [
      { title: "Plan top 3 priorities", kind: "planning", isLocked: true },
      { title: "Complete daily admin", kind: "ops", isLocked: false },
      { title: "End-of-day review", kind: "reflection", isLocked: true },
    ];
  }
  return [];
}

export function EngineProgramCentre({ engine }: { engine: EngineName }) {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [engineId, setEngineId] = React.useState<number | null>(null);
  const [program, setProgram] = React.useState<OSProgramRecord | null>(null);
  const [tasks, setTasks] = React.useState<OSProgramTaskRecord[]>([]);
  const [selectedDate, setSelectedDate] = React.useState(todayIso());
  const [completionMap, setCompletionMap] = React.useState<Map<number, boolean>>(new Map());
  const [consistency, setConsistency] = React.useState(0);
  const [selectedStats, setSelectedStats] = React.useState({ completed: 0, total: 0, pct: 0 });
  const [duration, setDuration] = React.useState<number>(90);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [windowIndex, setWindowIndex] = React.useState(0);
  const [windowSquares, setWindowSquares] = React.useState<
    Array<{ date: string; completed: number; total: number; pct: number }>
  >([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const title = ENGINE_TITLE[engine];
    try {
      let resolvedEngine = await db.engines.filter((row) => row.name === engine).first();
      if (!resolvedEngine?.id) {
        const id = await db.engines.add({
          name: engine,
          is_active: true,
          created_at: Date.now(),
        });
        resolvedEngine = await db.engines.get(id);
      }
      if (!resolvedEngine?.id) throw new Error("Failed to initialize engine");
      if (!resolvedEngine.is_active) {
        await db.engines.update(resolvedEngine.id, { is_active: true });
      }
      setEngineId(resolvedEngine.id);

      const activeProgram = await getActiveProgram(resolvedEngine.id);
      setProgram(activeProgram);

      if (!activeProgram?.id) {
        setTasks([]);
        setCompletionMap(new Map());
        setConsistency(0);
        setSelectedStats({ completed: 0, total: 0, pct: 0 });
        setWindowSquares([]);
        setWindowIndex(0);
        return;
      }

      const clampedDate =
        selectedDate < activeProgram.startDate
          ? activeProgram.startDate
          : selectedDate > activeProgram.endDate
            ? activeProgram.endDate
            : selectedDate;
      if (clampedDate !== selectedDate) {
        setSelectedDate(clampedDate);
      }

      const [taskRows, completion, score] = await Promise.all([
        listProgramTasks(activeProgram.id),
        getTaskCompletionMapForDate(activeProgram.id, clampedDate),
        getProgramAverageConsistency(
          activeProgram.id,
          activeProgram.startDate,
          todayIso() < activeProgram.endDate ? todayIso() : activeProgram.endDate,
        ),
      ]);
      setTasks(taskRows.filter((row) => row.isActive));
      setCompletionMap(completion);
      setConsistency(score);

      const dayStats = await getDayTaskStats(activeProgram.id, clampedDate);
      setSelectedStats(dayStats);

      const totalDays = Math.max(1, diffDaysISO(activeProgram.startDate, activeProgram.endDate) + 1);
      const maxWindow = Math.max(0, Math.ceil(totalDays / 30) - 1);
      const selectedWindow = Math.max(
        0,
        Math.min(maxWindow, Math.floor(diffDaysISO(activeProgram.startDate, clampedDate) / 30)),
      );
      const safeWindow = Math.max(0, Math.min(maxWindow, windowIndex || selectedWindow));
      if (safeWindow !== windowIndex) {
        setWindowIndex(safeWindow);
      }

      const window = getWindow(activeProgram.startDate, safeWindow);
      const windowEnd = window.endDate > activeProgram.endDate ? activeProgram.endDate : window.endDate;
      const squares = await getWindowSquares(activeProgram.id, window.startDate, windowEnd);
      setWindowSquares(squares);
      setMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage(`Unable to load ${title} command centre.`);
    } finally {
      setLoading(false);
    }
  }, [engine, selectedDate, windowIndex]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleStartProgram() {
    if (!engineId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createProgram(
        engineId,
        engine,
        todayIso(),
        duration,
        {},
        `${ENGINE_TITLE[engine]} ${duration}D Plan`,
      );
      for (const task of defaultTasks(engine)) {
        await addTask(created.id as number, task.title, task.kind, task.isLocked);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTask(taskId: number, checked: boolean) {
    if (!program?.id) return;
    setBusy(true);
    setError(null);
    try {
      await toggleTaskComplete(program.id, taskId, selectedDate, checked);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTask() {
    if (!program?.id || !newTaskTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addTask(program.id, newTaskTitle, "custom", false);
      setNewTaskTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExtend(days: 30 | 60 | 90) {
    if (!program?.id) return;
    setBusy(true);
    try {
      await extendProgram(program.id, days);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEndProgram() {
    if (!program?.id || !window.confirm("Archive this plan now?")) return;
    setBusy(true);
    try {
      await endProgram(program.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const tool = TOOL_LINK[engine];
  const timeline = program ? getProgramTimeline(program) : null;
  const totalDays = program ? Math.max(1, diffDaysISO(program.startDate, program.endDate) + 1) : 1;
  const maxWindow = Math.max(0, Math.ceil(totalDays / 30) - 1);

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">{ENGINE_TITLE[engine]} Command Centre</h1>
          {program && timeline ? (
            <p className="mt-2 text-sm text-white/70">
              {program.name} • Day {timeline.dayIndex}/{timeline.totalDays} • {consistency.toFixed(1)}%
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {tool ? (
            <Link href={tool.href} className="hud-btn px-3 py-1.5 text-sm text-white">
              {tool.label}
            </Link>
          ) : null}
          <Link href="/os" className="hud-btn px-3 py-1.5 text-sm text-white">
            Dashboard
          </Link>
        </div>
      </header>

      {error ? <p className="mb-3 rounded-md border border-red-400/35 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
      {message ? <p className="mb-3 rounded-md border border-white/15 bg-white/5 p-3 text-sm text-white/80">{message}</p> : null}

      {loading ? <p className="text-sm text-white/70">Loading...</p> : null}

      {!loading && !program ? (
        <section className="hud-panel max-w-xl p-5">
          <p className="text-sm text-white/75">No active {ENGINE_TITLE[engine]} plan.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
            >
              {[30, 60, 90, 120, 180, 365].map((option) => (
                <option key={option} value={option}>
                  {option} days
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleStartProgram()}
              disabled={busy}
              className="hud-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Set up your Plan
            </button>
          </div>
        </section>
      ) : null}

      {!loading && program ? (
        <div className="grid gap-4">
          <section className="hud-panel p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Analytics</h2>
              <p className="text-xs text-white/65">
                Selected {selectedDate} • {selectedStats.completed}/{selectedStats.total} • {selectedStats.pct}%
              </p>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWindowIndex((prev) => Math.max(0, prev - 1))}
                disabled={windowIndex <= 0}
                className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso())}
                className="hud-btn px-2 py-1 text-xs text-white"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setWindowIndex((prev) => Math.min(maxWindow, prev + 1))}
                disabled={windowIndex >= maxWindow}
                className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {windowSquares.map((square, index) => (
                <button
                  key={square.date}
                  type="button"
                  onClick={() => setSelectedDate(square.date)}
                  className={[
                    "h-9 rounded border text-[10px]",
                    selectedDate === square.date ? "border-white ring-1 ring-white/80" : "border-white/12",
                    square.pct >= 100
                      ? "bg-emerald-400/35"
                      : square.pct >= 80
                        ? "bg-emerald-300/20"
                        : square.pct >= 50
                          ? "bg-white/20"
                          : square.pct > 0
                            ? "bg-white/10"
                            : "bg-black/25",
                  ].join(" ")}
                  title={`${square.date} • ${square.pct}%`}
                >
                  {windowIndex * 30 + index + 1}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="hud-panel p-5">
              <h2 className="text-lg font-semibold text-white">Today Tasks</h2>
              <p className="mt-1 text-xs text-white/70">Equal-weight scoring. Locked and adjustable tasks count the same.</p>
              <div className="mt-3 space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-sm text-white/60">No tasks configured.</p>
                ) : (
                  tasks.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-center justify-between rounded-md border border-white/12 bg-black/20 px-3 py-2"
                    >
                      <span className="text-sm text-white">
                        {task.title} {task.isLocked ? <span className="text-xs text-white/60">🔒</span> : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={completionMap.get(task.id as number) ?? false}
                        onChange={(event) => void handleToggleTask(task.id as number, event.target.checked)}
                        className="h-4 w-4 accent-white"
                        disabled={busy}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="hud-panel p-5">
              <h2 className="text-lg font-semibold text-white">Actions</h2>
              <div className="mt-3 grid gap-2">
                <button type="button" onClick={() => void handleExtend(30)} className="hud-btn px-3 py-1.5 text-sm text-white">
                  Extend +30
                </button>
                <button type="button" onClick={() => void handleExtend(60)} className="hud-btn px-3 py-1.5 text-sm text-white">
                  Extend +60
                </button>
                <button type="button" onClick={() => void handleExtend(90)} className="hud-btn px-3 py-1.5 text-sm text-white">
                  Extend +90
                </button>
                <button type="button" onClick={() => void handleEndProgram()} className="hud-btn px-3 py-1.5 text-sm text-white">
                  Archive Plan
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Add adjustable task"
                  className="w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
                />
                <button type="button" onClick={() => void handleAddTask()} className="hud-btn px-3 py-2 text-sm text-white">
                  Add
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
