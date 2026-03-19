"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { ThreeMonthCalendar } from "../../../../components/calendar/ThreeMonthCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";
import { assertDateISO, dateFromISO, todayISO } from "../../../../lib/date";
import { computeMonthConsistency } from "../../../../lib/scoring";
import {
  addTaskToEngine,
  computeDayScore,
  getCompletionMap,
  getCompletionMapForRange,
  listAllTasks,
  toggleTaskCompletion,
  type UnifiedTask,
} from "../../../../lib/command_center";

const ENGINE_ORDER: UnifiedTask["engine"][] = ["body", "mind", "money", "general"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function getRangeFromOffset(monthOffset: number) {
  const base = addMonths(startOfMonth(new Date()), monthOffset);
  const start = toDateKey(startOfMonth(addMonths(base, -1)));
  const end = toDateKey(endOfMonth(base));
  return { start, end };
}

const ENGINE_LABELS: Record<UnifiedTask["engine"], string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  general: "GENERAL",
};

function engineLabel(engine: UnifiedTask["engine"]) {
  return ENGINE_LABELS[engine];
}

export default function CommandCenterClient() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const [selectedDateISO, setSelectedDateISO] = React.useState<string>(() => todayKey);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [newTaskEngine, setNewTaskEngine] = React.useState<UnifiedTask["engine"]>("body");
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskKind, setNewTaskKind] = React.useState<UnifiedTask["kind"]>("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [isCreatingTask, setIsCreatingTask] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("command.selectedDateISO") : null;
    if (!stored) return;
    try {
      setSelectedDateISO(assertDateISO(stored));
    } catch (err) {
      console.error(err);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("command.selectedDateISO", selectedDateISO);
  }, [selectedDateISO]);

  // --- Reactive Dexie subscriptions (useLiveQuery keeps in sync with all engines) ---
  const liveTasks = useLiveQuery(() => listAllTasks(), []);
  const tasks = React.useMemo(() => liveTasks ?? ([] as UnifiedTask[]), [liveTasks]);

  const liveCompletionSet = useLiveQuery(async () => {
      const safeDate = assertDateISO(selectedDateISO);
      return getCompletionMap(safeDate);
    }, [selectedDateISO]);
  const completionSet = React.useMemo(() => liveCompletionSet ?? new Set<string>(), [liveCompletionSet]);

  const liveScoreByDate = useLiveQuery(async () => {
      const { start, end } = getRangeFromOffset(monthOffset);
      const [completionMap, allTasks] = await Promise.all([
        getCompletionMapForRange(start, end),
        listAllTasks(),
      ]);
      const map: Record<string, number> = {};
      const startDate = dateFromISO(start);
      const endDate = dateFromISO(end);
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      for (let i = 0; i < totalDays; i += 1) {
        const dateKey = toDateKey(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
        const set = completionMap.get(dateKey) ?? new Set<string>();
        map[dateKey] = computeDayScore(allTasks, set).percent;
      }
      return map;
    }, [monthOffset]);
  const scoreByDate = React.useMemo(() => liveScoreByDate ?? ({} as Record<string, number>), [liveScoreByDate]);

  const startDateISO = React.useMemo(() => {
    if (tasks.length === 0) return todayKey;
    const earliest = tasks.reduce((min, task) => Math.min(min, task.createdAt), tasks[0].createdAt);
    return toDateKey(new Date(earliest));
  }, [tasks, todayKey]);

  const centerMonth = React.useMemo(
    () => addMonths(startOfMonth(new Date()), monthOffset),
    [monthOffset],
  );

  const consistency = React.useMemo(() => {
    const mStart = toDateKey(startOfMonth(centerMonth));
    const mEnd = toDateKey(endOfMonth(centerMonth));
    return computeMonthConsistency(scoreByDate, mStart, mEnd, startDateISO, todayKey);
  }, [centerMonth, startDateISO, todayKey, scoreByDate]);

  function handleDateSelect(nextISO: string) {
    try {
      setSelectedDateISO(assertDateISO(nextISO));
    } catch (err) {
      console.error(err);
      setSelectedDateISO(todayKey);
    }
  }

  const score = React.useMemo(() => computeDayScore(tasks, completionSet), [tasks, completionSet]);

  const mainTasks = React.useMemo(() => {
    return tasks
      .filter((task) => task.kind === "main")
      .map((task) => ({ ...task, completed: completionSet.has(task.id) }))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine);
      });
  }, [tasks, completionSet]);

  const secondaryTasks = React.useMemo(() => {
    return tasks
      .filter((task) => task.kind === "secondary")
      .map((task) => ({ ...task, completed: completionSet.has(task.id) }))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine);
      });
  }, [tasks, completionSet]);

  async function handleToggle(task: UnifiedTask & { completed: boolean }) {
    await toggleTaskCompletion(task.id, selectedDateISO, task.completed);
  }

  function openAddTask(kind: UnifiedTask["kind"]) {
    setCreateError(null);
    setNewTaskKind(kind);
    setIsAddingTask(true);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) {
      setCreateError("Title is required.");
      return;
    }
    setIsCreatingTask(true);
    setCreateError(null);
    try {
      await addTaskToEngine({
        engine: newTaskEngine,
        title,
        kind: newTaskKind,
        daysPerWeek: newTaskDaysPerWeek,
        dateISO: selectedDateISO,
      });
      setNewTaskTitle("");
      setNewTaskKind("main");
      setNewTaskDaysPerWeek(7);
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setIsCreatingTask(false);
    }
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">COMMAND CENTER</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">All engines. One view.</p>
        </header>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">{score.percent}%</p>
          <p className="mt-2 text-xs text-white/65">
            Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal}
          </p>
          <div className="tp-progress mt-3">
            <span style={{ width: `${score.percent}%` }} />
          </div>
        </section>
      </div>

      <div className="cc-content-grid mt-4">
        <ThreeMonthCalendar
          selectedDateISO={selectedDateISO}
          onSelect={handleDateSelect}
          monthOffset={monthOffset}
          onMonthOffsetChange={setMonthOffset}
          scoreByDate={scoreByDate}
          startDateISO={startDateISO}
          todayISO={todayKey}
          monthCount={2}
        />

        <section className="tp-panel p-4">
          <p className="tp-kicker">Consistency</p>
          <p className="tp-score-value text-3xl">{consistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div>
              <p className="body-consistency-label">Consistent Days</p>
              <p className="body-consistency-value">
                {consistency.consistentDays} / {consistency.daysElapsed}
              </p>
            </div>
            <div>
              <p className="body-consistency-label">Current Streak</p>
              <p className="body-consistency-value">{consistency.currentStreak} days</p>
            </div>
            <div>
              <p className="body-consistency-label">Best Streak</p>
              <p className="body-consistency-value">{consistency.bestStreak} days</p>
            </div>
          </div>
          <div className="mt-4">
            <BodyMonthlyHeatBars
              visibleMonth={centerMonth}
              scoreMap={scoreByDate}
              startDateKey={startDateISO}
              todayKey={todayKey}
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Main Tasks</p>
            <p className="tp-muted">{selectedDateISO}</p>
          </div>

          {mainTasks.length === 0 ? (
            <div className="body-empty mt-4">
              <p>No main tasks yet.</p>
              <button type="button" onClick={() => openAddTask("main")} className="tp-button mt-4 inline-flex w-auto px-4">
                Add Task
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {mainTasks.map((task) => (
                <div key={task.id} className="cc-task-row body-task-row">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggle(task)}
                      className="h-4 w-4 accent-white"
                    />
                    <span className={task.completed ? "line-through text-white/40" : ""}>{task.title}</span>
                  </label>
                  <div className="cc-task-meta">
                    <span className="body-badge">{engineLabel(task.engine)}</span>
                    <span className="tp-muted text-xs">2 pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => openAddTask("main")} className="tp-button mt-4 inline-flex w-auto px-4">
            Add Task
          </button>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Secondary Tasks</p>
            <p className="tp-muted">{selectedDateISO}</p>
          </div>

          {secondaryTasks.length === 0 ? (
            <div className="body-empty mt-4">
              <p>No secondary tasks yet.</p>
              <button type="button" onClick={() => openAddTask("secondary")} className="tp-button mt-4 inline-flex w-auto px-4">
                Add Task
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {secondaryTasks.map((task) => (
                <div key={task.id} className="cc-task-row body-task-row">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggle(task)}
                      className="h-4 w-4 accent-white"
                    />
                    <span className={task.completed ? "line-through text-white/40" : ""}>{task.title}</span>
                  </label>
                  <div className="cc-task-meta">
                    <span className="body-badge">{engineLabel(task.engine)}</span>
                    <span className="tp-muted text-xs">1 pt</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => openAddTask("secondary")} className="tp-button mt-4 inline-flex w-auto px-4">
            Add Task
          </button>
        </section>
      </div>

      {isAddingTask ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">New Command Center Task</p>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle("");
                  setCreateError(null);
                }}
                className="tp-button tp-button-inline"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="body-label">Engine</label>
                <select
                  value={newTaskEngine}
                  onChange={(event) => setNewTaskEngine(event.target.value as UnifiedTask["engine"])}
                  className="body-select"
                >
                  <option value="body">Body</option>
                  <option value="mind">Mind</option>
                  <option value="money">Money</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="body-label">Title</label>
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  className="body-input"
                  placeholder="Task title"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddTask();
                    }
                  }}
                />
              </div>
              <div>
                <label className="body-label">Priority</label>
                <select
                  value={newTaskKind}
                  onChange={(event) => setNewTaskKind(event.target.value as UnifiedTask["kind"])}
                  className="body-select"
                >
                  <option value="main">Main (2 pts)</option>
                  <option value="secondary">Secondary (1 pt)</option>
                </select>
              </div>
              <div>
                <label className="body-label">How many days per week?</label>
                <p className="tp-muted mb-1" style={{ fontSize: "0.75rem" }}>
                  Set less than 7 if you take rest days — skipping won&apos;t hurt your score once the weekly goal is met.
                </p>
                <select
                  value={newTaskDaysPerWeek}
                  onChange={(event) => setNewTaskDaysPerWeek(Number(event.target.value))}
                  className="body-select"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n === 7 ? `${n} days (every day)` : `${n} day${n > 1 ? "s" : ""} per week`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {createError ? (
              <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {createError}
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">
                {isCreatingTask ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle("");
                  setCreateError(null);
                }}
                className="tp-button w-auto px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
