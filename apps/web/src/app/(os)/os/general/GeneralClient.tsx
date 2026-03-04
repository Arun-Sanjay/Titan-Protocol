"use client";

import * as React from "react";

import {
  addGeneralTask,
  deleteGeneralTask,
  ensureGeneralMeta,
  getGeneralScoreMapForRange,
  getOrCreateGeneralLog,
  listGeneralTasks,
  renameGeneralTask,
  toggleGeneralTaskForDate,
  updateGeneralTaskPriority,
} from "../../../../lib/general";
import type { GeneralTask } from "../../../../lib/db";
import { computeBodyDayScore } from "../../../../lib/bodyScore";
import { assertDateISO, todayISO } from "../../../../lib/date";
import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";

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

export default function GeneralClient({ initialDate }: { initialDate: string | null }) {
  const todayKey = React.useMemo(() => todayISO(), []);
  const initialDateKey = React.useMemo(() => {
    if (initialDate) {
      try {
        return assertDateISO(initialDate);
      } catch (err) {
        console.error(err);
      }
    }
    return todayKey;
  }, [initialDate, todayKey]);

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(initialDateKey);
  const [tasks, setTasks] = React.useState<GeneralTask[]>([]);
  const [completedIds, setCompletedIds] = React.useState<Set<number>>(new Set());
  const [generalStartDateKey, setGeneralStartDateKey] = React.useState<string>("");
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => startOfMonth(parseDateKey(initialDateKey)));
  const [monthScoreMap, setMonthScoreMap] = React.useState<Record<string, number>>({});
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);
  const [calendarTick, setCalendarTick] = React.useState(0);

  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    try {
      setSelectedDateKey(assertDateISO(nextDateKey));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
  }

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
    let isMounted = true;

    async function hydrate() {
      let safeDate: string;
      try {
        safeDate = assertDateISO(selectedDateKey);
      } catch (err) {
        console.error(err);
        return;
      }
      const meta = await ensureGeneralMeta(safeDate);
      setGeneralStartDateKey(meta.startDate);
      const [taskDefs, log] = await Promise.all([listGeneralTasks(), getOrCreateGeneralLog(safeDate)]);

      if (!isMounted) return;
      setTasks(taskDefs);
      setCompletedIds(new Set(log.completedTaskIds));
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [selectedDateKey]);

  React.useEffect(() => {
    let mounted = true;
    async function loadMonthScores() {
      const startKey = toDateKey(startOfMonth(visibleMonth));
      const endKey = toDateKey(endOfMonth(visibleMonth));
      const map = await getGeneralScoreMapForRange(startKey, endKey);
      if (mounted) setMonthScoreMap(map);
    }
    loadMonthScores();
    return () => {
      mounted = false;
    };
  }, [visibleMonth, calendarTick]);

  async function handleToggleTask(task: GeneralTask) {
    if (!task.id) return;
    const log = await toggleGeneralTaskForDate(selectedDateKey, task.id);
    setCompletedIds(new Set(log.completedTaskIds));
    setCalendarTick((prev) => prev + 1);
    if (!generalStartDateKey || selectedDateKey < generalStartDateKey) {
      setGeneralStartDateKey(selectedDateKey);
    }
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    await addGeneralTask(title, newTaskPriority);
    const storedTasks = await listGeneralTasks();
    setTasks(storedTasks);
    setCalendarTick((prev) => prev + 1);
    setNewTaskTitle("");
    setNewTaskPriority("main");
    setIsAddingTask(false);
  }

  const tasksWithCompletion = React.useMemo(
    () =>
      tasks.map((task) => ({
        ...task,
        completed: completedIds.has(task.id ?? -1),
      })),
    [completedIds, tasks],
  );

  const mainTasks = tasksWithCompletion.filter((task) => task.priority === "main");
  const secondaryTasks = tasksWithCompletion.filter((task) => task.priority === "secondary");
  const hasTasks = tasks.length > 0;
  const score = computeBodyDayScore(tasksWithCompletion as Array<GeneralTask & { completed: boolean }>);
  const monthStartKey = React.useMemo(() => toDateKey(startOfMonth(visibleMonth)), [visibleMonth]);
  const monthEndKey = React.useMemo(() => toDateKey(endOfMonth(visibleMonth)), [visibleMonth]);
  const referenceKey = selectedDateKey;

  const consistency = React.useMemo(() => {
    const effectiveStartKey =
      generalStartDateKey && generalStartDateKey > monthStartKey ? generalStartDateKey : monthStartKey;
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
  }, [generalStartDateKey, monthEndKey, monthScoreMap, monthStartKey, referenceKey]);

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">GENERAL ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Forever tracker • {selectedDateKey}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/65">
            <span className="body-consistency-label">Selected</span>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(event) => handleDateChange(event.target.value)}
              className="body-select h-8 px-2"
            />
          </div>
        </header>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">{score.percent}%</p>
          <p className="mt-2 text-xs text-white/65">
            Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal} • Points{" "}
            {score.pointsDone}/{score.pointsTotal}
          </p>
          <div className="tp-progress mt-3">
            <span style={{ width: `${score.percent}%` }} />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={handleDateChange}
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          scoreMap={monthScoreMap}
          referenceDateKey={selectedDateKey}
          startDateKey={generalStartDateKey}
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
              startDateKey={generalStartDateKey}
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

          {!hasTasks && secondaryTasks.length === 0 ? (
            <div className="body-empty mt-4">
              <p>No secondary tasks for this date.</p>
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="tp-button mt-4 inline-flex w-auto px-4"
              >
                Add Task
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {secondaryTasks.length === 0 ? (
                <div className="body-empty">No secondary tasks.</div>
              ) : (
                secondaryTasks.map((task) => (
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
                              if (!task.id) return;
                              await updateGeneralTaskPriority(task.id, "main");
                              const stored = await listGeneralTasks();
                              setTasks(stored);
                              setCalendarTick((prev) => prev + 1);
                            }}
                          >
                            Move to Main
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!task.id) return;
                              const nextTitle = window.prompt("Rename task", task.title);
                              if (!nextTitle) return;
                              await renameGeneralTask(task.id, nextTitle.trim());
                              const stored = await listGeneralTasks();
                              setTasks(stored);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!task.id) return;
                              await deleteGeneralTask(task.id);
                              const stored = await listGeneralTasks();
                              setTasks(stored);
                              setCompletedIds((prev) => {
                                const next = new Set(prev);
                                next.delete(task.id);
                                return next;
                              });
                              setCalendarTick((prev) => prev + 1);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAddingTask(true)}
            className="tp-button mt-4 inline-flex w-auto px-4"
          >
            Add Task
          </button>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Main Tasks</p>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>

          {!hasTasks && mainTasks.length === 0 ? (
            <div className="body-empty mt-4">
              <p>No main tasks for this date.</p>
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="tp-button mt-4 inline-flex w-auto px-4"
              >
                Add Task
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {mainTasks.length === 0 ? (
                <div className="body-empty">No main tasks.</div>
              ) : (
                mainTasks.map((task) => (
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
                              if (!task.id) return;
                              await updateGeneralTaskPriority(task.id, "secondary");
                              const stored = await listGeneralTasks();
                              setTasks(stored);
                              setCalendarTick((prev) => prev + 1);
                            }}
                          >
                            Move to Secondary
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!task.id) return;
                              const nextTitle = window.prompt("Rename task", task.title);
                              if (!nextTitle) return;
                              await renameGeneralTask(task.id, nextTitle.trim());
                              const stored = await listGeneralTasks();
                              setTasks(stored);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!task.id) return;
                              await deleteGeneralTask(task.id);
                              const stored = await listGeneralTasks();
                              setTasks(stored);
                              setCompletedIds((prev) => {
                                const next = new Set(prev);
                                next.delete(task.id);
                                return next;
                              });
                              setCalendarTick((prev) => prev + 1);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsAddingTask(true)}
            className="tp-button mt-4 inline-flex w-auto px-4"
          >
            Add Task
          </button>
        </section>
      </div>

      {isAddingTask ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">New General Task</p>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle("");
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
                  value={newTaskPriority}
                  onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")}
                  className="body-select"
                >
                  <option value="main">Main (2 pts)</option>
                  <option value="secondary">Secondary (1 pt)</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle("");
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
