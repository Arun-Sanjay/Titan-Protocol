"use client";

import * as React from "react";

import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";
import type { MindTask } from "../../../../lib/db";
import { assertDateISO, todayISO } from "../../../../lib/date";
import {
  addMindTask,
  deleteMindTask,
  ensureMindMeta,
  getMindScoreMapForRange,
  listMindCompletions,
  listMindTasks,
  renameMindTask,
  setMindTaskCompletion,
  updateMindTaskKind,
} from "../../../../lib/mind";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export default function MindPage() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => startOfMonth(parseDateKey(todayKey)));
  const [tasks, setTasks] = React.useState<MindTask[]>([]);
  const [completedIds, setCompletedIds] = React.useState<Set<string>>(new Set());
  const [monthScoreMap, setMonthScoreMap] = React.useState<Record<string, number>>({});
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskKind, setNewTaskKind] = React.useState<"main" | "secondary">("main");
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [creatingTask, setCreatingTask] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [calendarTick, setCalendarTick] = React.useState(0);
  const [mindStartDateKey, setMindStartDateKey] = React.useState<string>("");

  const handleSelectDate = React.useCallback((next: string) => {
    if (!next) return;
    try {
      setSelectedDateKey(assertDateISO(next));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
  }, []);

  React.useEffect(() => {
    if (!selectedDateKey) return;
    let safeDate: string;
    try {
      safeDate = assertDateISO(selectedDateKey);
    } catch (err) {
      console.error(err);
      return;
    }
    const selectedDate = parseDateKey(safeDate);
    if (
      selectedDate.getFullYear() !== visibleMonth.getFullYear() ||
      selectedDate.getMonth() !== visibleMonth.getMonth()
    ) {
      setVisibleMonth(startOfMonth(selectedDate));
    }
  }, [selectedDateKey, visibleMonth]);

  React.useEffect(() => {
    let mounted = true;
    async function hydrate() {
      let safeDate: string;
      try {
        safeDate = assertDateISO(selectedDateKey);
      } catch (err) {
        console.error(err);
        return;
      }
      const [taskDefs, completions, meta] = await Promise.all([
        listMindTasks(),
        listMindCompletions(safeDate),
        ensureMindMeta(safeDate),
      ]);
      if (!mounted) return;
      setTasks(taskDefs);
      setCompletedIds(new Set(completions.filter((c) => c.completed).map((c) => c.task_id)));
      setMindStartDateKey(meta.startDate);
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, [selectedDateKey, calendarTick]);

  React.useEffect(() => {
    let mounted = true;
    async function loadMonthScores() {
      const monthKey = toDateKey(startOfMonth(visibleMonth));
      const map = await getMindScoreMapForRange(monthKey);
      if (mounted) setMonthScoreMap(map);
    }
    loadMonthScores();
    return () => {
      mounted = false;
    };
  }, [visibleMonth, calendarTick]);

  async function handleToggleTask(task: MindTask) {
    const nextCompleted = !completedIds.has(task.id);
    await setMindTaskCompletion(selectedDateKey, task.id, nextCompleted);
    const completions = await listMindCompletions(selectedDateKey);
    setCompletedIds(new Set(completions.filter((c) => c.completed).map((c) => c.task_id)));
    setCalendarTick((prev) => prev + 1);
    if (!mindStartDateKey || selectedDateKey < mindStartDateKey) {
      setMindStartDateKey(selectedDateKey);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!taskId) return;
    if (!confirm("Delete this task?")) return;
    try {
      await deleteMindTask(taskId);
      const [nextTasks, nextCompletions] = await Promise.all([
        listMindTasks(),
        listMindCompletions(selectedDateKey),
      ]);
      setTasks(nextTasks);
      setCompletedIds(new Set(nextCompletions.filter((c) => c.completed).map((c) => c.task_id)));
      setCalendarTick((prev) => prev + 1);
    } catch (err) {
      console.error("Delete task failed", err);
    }
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) {
      setCreateError("Title required.");
      return;
    }
    if (newTaskKind !== "main" && newTaskKind !== "secondary") {
      setCreateError("Select Main or Secondary.");
      return;
    }
    setCreatingTask(true);
    setCreateError(null);
    try {
      await addMindTask({ title, kind: newTaskKind, dateISO: selectedDateKey });
      const taskDefs = await listMindTasks();
      setTasks(taskDefs);
      setCalendarTick((prev) => prev + 1);
      setNewTaskTitle("");
      setNewTaskKind("main");
      setIsAddingTask(false);
      if (!mindStartDateKey || selectedDateKey < mindStartDateKey) {
        setMindStartDateKey(selectedDateKey);
      }
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingTask(false);
    }
  }

  const tasksWithCompletion = React.useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        completed: completedIds.has(task.id),
      })),
    [completedIds, tasks],
  );

  const mainTasks = tasksWithCompletion.filter((task) => task.kind === "main");
  const secondaryTasks = tasksWithCompletion.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => task.completed).length;
  const secondaryDone = secondaryTasks.filter((task) => task.completed).length;
  const mainTotal = mainTasks.length;
  const secondaryTotal = secondaryTasks.length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const scorePercent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);

  const monthStartKey = React.useMemo(() => toDateKey(startOfMonth(visibleMonth)), [visibleMonth]);
  const monthEndKey = React.useMemo(() => toDateKey(endOfMonth(visibleMonth)), [visibleMonth]);
  const referenceKey = selectedDateKey;

  const consistency = React.useMemo(() => {
    const effectiveStartKey = mindStartDateKey && mindStartDateKey > monthStartKey ? mindStartDateKey : monthStartKey;
    const effectiveEndKey = referenceKey < monthEndKey ? referenceKey : monthEndKey;

    if (!effectiveStartKey || effectiveStartKey > effectiveEndKey) {
      return { consistencyPct: 0, consistentDays: 0, daysElapsed: 0, currentStreak: 0, bestStreak: 0 };
    }

    let daysElapsed = 0;
    let consistentDays = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let runningStreak = 0;

    const startDate = parseDateKey(effectiveStartKey);
    const endDate = parseDateKey(effectiveEndKey);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

    for (let i = 0; i < totalDays; i += 1) {
      const dateKey = toDateKey(addDays(startDate, i));
      const scorePct = monthScoreMap[dateKey] ?? 0;
      daysElapsed += 1;
      if (scorePct >= 60) {
        consistentDays += 1;
        runningStreak += 1;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else {
        runningStreak = 0;
      }
    }

    const streakStartDate = parseDateKey(effectiveEndKey);
    for (let i = 0; i < totalDays; i += 1) {
      const dateKey = toDateKey(addDays(streakStartDate, -i));
      const scorePct = monthScoreMap[dateKey] ?? 0;
      if (scorePct >= 60) {
        currentStreak += 1;
      } else {
        break;
      }
    }

    const consistencyPct = daysElapsed === 0 ? 0 : Math.round((consistentDays / daysElapsed) * 100);

    return { consistencyPct, consistentDays, daysElapsed, currentStreak, bestStreak };
  }, [mindStartDateKey, monthEndKey, monthScoreMap, monthStartKey, referenceKey]);

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MIND ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Forever tracker • {selectedDateKey}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/65">
            <span className="body-consistency-label">Selected</span>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(event) => handleSelectDate(event.target.value)}
              className="body-select h-8 px-2"
            />
          </div>
        </header>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">{scorePercent}%</p>
          <p className="mt-2 text-xs text-white/65">
            Main {mainDone}/{mainTotal} • Secondary {secondaryDone}/{secondaryTotal} • Points {pointsDone}/{pointsTotal}
          </p>
          <div className="tp-progress mt-3">
            <span style={{ width: `${scorePercent}%` }} />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={handleSelectDate}
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          scoreMap={monthScoreMap}
          referenceDateKey={selectedDateKey}
          startDateKey={mindStartDateKey}
        />

        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Consistency</p>
          <p className="tp-score-value text-3xl mt-2">{consistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div className="body-consistency-row">
              <p className="body-consistency-label">Consistent Days</p>
              <p className="body-consistency-value">
                {consistency.consistentDays} / {consistency.daysElapsed}
              </p>
            </div>
            <div className="body-consistency-row">
              <p className="body-consistency-label">Current Streak</p>
              <p className="body-consistency-value">{consistency.currentStreak} days</p>
            </div>
            <div className="body-consistency-row">
              <p className="body-consistency-label">Best Streak</p>
              <p className="body-consistency-value">{consistency.bestStreak} days</p>
            </div>
          </div>
          <div className="mt-4">
            <BodyMonthlyHeatBars
              visibleMonth={visibleMonth}
              scoreMap={monthScoreMap}
              todayKey={selectedDateKey}
              startDateKey={mindStartDateKey}
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Secondary Tasks</p>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>

          {secondaryTasks.length === 0 ? (
            <div className="body-empty mt-4">No Mind tasks yet. Add your first task.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {secondaryTasks.map((task) => (
                <div key={task.id} className="body-task-row">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task)}
                      className="h-4 w-4 accent-white"
                    />
                    <span>{task.title}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="body-badge">SECONDARY</span>
                    <details className="body-menu">
                      <summary>•••</summary>
                      <div className="body-menu-panel">
                        <button
                          type="button"
                          onClick={async () => {
                            await updateMindTaskKind(task.id, "main");
                            const nextTasks = await listMindTasks();
                            setTasks(nextTasks);
                            setCalendarTick((prev) => prev + 1);
                          }}
                        >
                          Move to Main
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const nextTitle = window.prompt("Rename task", task.title);
                            if (!nextTitle) return;
                            await renameMindTask(task.id, nextTitle.trim());
                            const nextTasks = await listMindTasks();
                            setTasks(nextTasks);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleDeleteTask(task.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAddingTask(true)}
            className="tp-button mt-4 inline-flex w-auto px-4"
          >
            + Add Task
          </button>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Main Tasks</p>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>

          {mainTasks.length === 0 ? (
            <div className="body-empty mt-4">No Mind tasks yet. Add your first task.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {mainTasks.map((task) => (
                <div key={task.id} className="body-task-row">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task)}
                      className="h-4 w-4 accent-white"
                    />
                    <span>{task.title}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="body-badge">MAIN</span>
                    <details className="body-menu">
                      <summary>•••</summary>
                      <div className="body-menu-panel">
                        <button
                          type="button"
                          onClick={async () => {
                            await updateMindTaskKind(task.id, "secondary");
                            const nextTasks = await listMindTasks();
                            setTasks(nextTasks);
                            setCalendarTick((prev) => prev + 1);
                          }}
                        >
                          Move to Secondary
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const nextTitle = window.prompt("Rename task", task.title);
                            if (!nextTitle) return;
                            await renameMindTask(task.id, nextTitle.trim());
                            const nextTasks = await listMindTasks();
                            setTasks(nextTasks);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleDeleteTask(task.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAddingTask(true)}
            className="tp-button mt-4 inline-flex w-auto px-4"
          >
            + Add Task
          </button>
        </section>
      </div>

      {isAddingTask ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">New Mind Task</p>
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
                <label className="body-label">Title</label>
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  className="body-input"
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="body-label">Priority</label>
                <select
                  value={newTaskKind}
                  onChange={(event) => setNewTaskKind(event.target.value as "main" | "secondary")}
                  className="body-select"
                >
                  <option value="main">Main (2 pts)</option>
                  <option value="secondary">Secondary (1 pt)</option>
                </select>
              </div>
            </div>
            {createError ? (
              <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {createError}
              </div>
            ) : null}
            {process.env.NODE_ENV !== "production" ? (
              <div className="mt-3 text-[11px] text-white/45">
                Debug: title="{newTaskTitle}" • kind={newTaskKind} • {creatingTask ? "creating..." : "idle"}
              </div>
            ) : null}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">
                {creatingTask ? "Creating..." : "Create"}
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
