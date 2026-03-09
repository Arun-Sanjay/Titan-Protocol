"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "../../../../lib/db";
import {
  addGeneralTask,
  deleteGeneralTask,
  ensureGeneralMeta,
  getGeneralScoreMapForRange,
  renameGeneralTask,
  toggleGeneralTaskForDate,
  updateGeneralTaskPriority,
} from "../../../../lib/general";
import { computeBodyDayScore } from "../../../../lib/bodyScore";
import {
  addDaysISO,
  assertDateISO,
  dateFromISO,
  dateToISO,
  monthBounds,
  todayISO,
} from "../../../../lib/date";
import { computeMonthConsistency } from "../../../../lib/scoring";
import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";


export default function GeneralClient() {
  const todayKey = React.useMemo(() => todayISO(), []);

  // --- UI state ---
  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);

  // --- Persist selected date ---
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("general.selectedDateISO") : null;
    if (!stored) return;
    try {
      setSelectedDateKey(assertDateISO(stored));
    } catch (err) {
      console.error(err);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("general.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

  // --- Ensure meta record exists ---
  React.useEffect(() => {
    ensureGeneralMeta(selectedDateKey).catch(console.error);
  }, [selectedDateKey]);

  // --- Sync visible month ---
  React.useEffect(() => {
    if (!selectedDateKey) return;
    let safeDate: string;
    try {
      safeDate = assertDateISO(selectedDateKey);
    } catch (err) {
      console.error(err);
      return;
    }
    const selectedMonthStart = monthBounds(safeDate).start;
    const visibleMonthStart = monthBounds(dateToISO(visibleMonth)).start;
    if (selectedMonthStart !== visibleMonthStart) {
      setVisibleMonth(dateFromISO(selectedMonthStart));
    }
  }, [selectedDateKey, visibleMonth]);

  // --- Reactive Dexie subscriptions ---
  const tasks = useLiveQuery(() => db.general_tasks.toArray(), []) ?? [];

  const generalLog = useLiveQuery(
    () => db.general_logs.where("dateKey").equals(selectedDateKey).first(),
    [selectedDateKey],
  );
  const completedIds = React.useMemo(
    () => new Set(generalLog?.completedTaskIds ?? []),
    [generalLog],
  );

  const generalMeta = useLiveQuery(() => db.general_meta.get("general"), []);
  const generalStartDateKey = generalMeta?.startDate ?? "";

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);
  const monthEndKey = React.useMemo(
    () => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1),
    [visibleMonth],
  );

  const monthScoreMap =
    useLiveQuery(
      () => getGeneralScoreMapForRange(monthStartKey, monthEndKey),
      [monthStartKey, monthEndKey],
    ) ?? ({} as Record<string, number>);

  // --- Derived ---
  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    try {
      setSelectedDateKey(assertDateISO(nextDateKey));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
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
  const score = computeBodyDayScore(tasksWithCompletion as Array<(typeof tasks)[number] & { completed: boolean }>);

  const consistency = React.useMemo(
    () => computeMonthConsistency(monthScoreMap, monthStartKey, monthEndKey, generalStartDateKey, selectedDateKey),
    [monthScoreMap, monthStartKey, monthEndKey, generalStartDateKey, selectedDateKey],
  );

  // --- Mutation handlers ---
  async function handleToggleTask(task: (typeof tasks)[number]) {
    if (!task.id) return;
    await toggleGeneralTaskForDate(selectedDateKey, task.id);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    await addGeneralTask(title, newTaskPriority, newTaskDaysPerWeek);
    setNewTaskTitle("");
    setNewTaskPriority("main");
    setNewTaskDaysPerWeek(7);
    setIsAddingTask(false);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">GENERAL ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Daily log · {selectedDateKey}</p>
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
                          <button type="button" onClick={async () => { if (!task.id) return; await updateGeneralTaskPriority(task.id, "main"); }}>
                            Move to Main
                          </button>
                          <button type="button" onClick={async () => { if (!task.id) return; const t = window.prompt("Rename task", task.title); if (!t) return; await renameGeneralTask(task.id, t.trim()); }}>
                            Rename
                          </button>
                          <button type="button" onClick={async () => { if (!task.id) return; await deleteGeneralTask(task.id); }}>
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

          <button type="button" onClick={() => setIsAddingTask(true)} className="tp-button mt-4 inline-flex w-auto px-4">
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
              <button type="button" onClick={() => setIsAddingTask(true)} className="tp-button mt-4 inline-flex w-auto px-4">
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
                          <button type="button" onClick={async () => { if (!task.id) return; await updateGeneralTaskPriority(task.id, "secondary"); }}>
                            Move to Secondary
                          </button>
                          <button type="button" onClick={async () => { if (!task.id) return; const t = window.prompt("Rename task", task.title); if (!t) return; await renameGeneralTask(task.id, t.trim()); }}>
                            Rename
                          </button>
                          <button type="button" onClick={async () => { if (!task.id) return; await deleteGeneralTask(task.id); }}>
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

          <button type="button" onClick={() => setIsAddingTask(true)} className="tp-button mt-4 inline-flex w-auto px-4">
            Add Task
          </button>
        </section>
      </div>

      {isAddingTask ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">New General Task</p>
              <button type="button" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }} className="tp-button tp-button-inline">
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
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                />
              </div>
              <div>
                <label className="body-label">Priority</label>
                <select value={newTaskPriority} onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")} className="body-select">
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
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">Create</button>
              <button type="button" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }} className="tp-button w-auto px-4">Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
