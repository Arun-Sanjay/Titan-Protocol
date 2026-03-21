"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { MobileModal } from "../../../../components/ui/MobileModal";
import { MobileSubNav, ENGINE_TABS } from "../../components/MobileSubNav";
import { db } from "../../../../lib/db";
import {
  addGeneralTask,
  deleteGeneralTask,
  ensureGeneralMeta,
  getGeneralScoreMapForRange,
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
import {
  TitanPageHeader,
  TitanPanel,
  TitanPanelHeader,
  TitanProgress,
  TitanButton,
  TitanEmptyState,
} from "../../../../components/ui/titan-primitives";


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
    <main className="tx-body-page w-full px-2 py-2 sm:px-4 sm:py-4">
      <MobileSubNav tabs={ENGINE_TABS} />
      <TitanPageHeader
        kicker="General Engine"
        title="GENERAL"
        subtitle={`Daily performance log · ${selectedDateKey}`}
        rightSlot={
          <div className="tx-date-pill">
            <span className="tx-kicker">Selected</span>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </div>
        }
      />

      <TitanPanel className="mt-4">
        <p className="tx-kicker">Day Score</p>
        <p className="tx-score-main tx-display mt-1">{score.percent}%</p>
        <p className="tx-muted mt-2">
          Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal} • Points{" "}
          {score.pointsDone}/{score.pointsTotal}
        </p>
        <TitanProgress value={score.percent} className="mt-3" />
      </TitanPanel>

      <div className="tx-body-grid mt-4">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={handleDateChange}
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          scoreMap={monthScoreMap}
          referenceDateKey={selectedDateKey}
          startDateKey={generalStartDateKey}
        />

        <TitanPanel>
          <p className="tx-kicker">Consistency</p>
          <p className="tx-score-main tx-display mt-2">{consistency.consistencyPct}%</p>
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
        </TitanPanel>
      </div>

      <div className="tx-body-tasks mt-4">
        <TitanPanel>
          <TitanPanelHeader kicker="Secondary Tasks" rightSlot={<span className="tx-muted">{selectedDateKey}</span>} />

          {!hasTasks && secondaryTasks.length === 0 ? (
            <TitanEmptyState
              title="No secondary tasks"
              description="Add your first secondary task to start tracking."
              action={{ label: "Add Task", onClick: () => setIsAddingTask(true) }}
              className="mt-4"
            />
          ) : (
            <div className="tx-task-list">
              {secondaryTasks.length === 0 ? (
                <div className="tx-task-empty">No secondary tasks.</div>
              ) : (
                secondaryTasks.map((task) => (
                  <div key={task.id} className="tx-task-row">
                    <div className="tx-task-left">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                      />
                      <span>{task.title}</span>
                    </div>
                    <div className="tx-task-right">
                      <span className="tx-pill">Secondary</span>
                      <details className="body-menu">
                        <summary>•••</summary>
                        <div className="body-menu-panel">
                          <button type="button" onClick={async () => { if (!task.id) return; await updateGeneralTaskPriority(task.id, "main"); }}>
                            Move to Main
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

          <TitanButton onClick={() => setIsAddingTask(true)} compact className="mt-4">
            Add Task
          </TitanButton>
        </TitanPanel>

        <TitanPanel>
          <TitanPanelHeader kicker="Main Tasks" rightSlot={<span className="tx-muted">{selectedDateKey}</span>} />

          {!hasTasks && mainTasks.length === 0 ? (
            <TitanEmptyState
              title="No main tasks"
              description="Add your first main task to start tracking."
              action={{ label: "Add Task", onClick: () => setIsAddingTask(true) }}
              className="mt-4"
            />
          ) : (
            <div className="tx-task-list">
              {mainTasks.length === 0 ? (
                <div className="tx-task-empty">No main tasks.</div>
              ) : (
                mainTasks.map((task) => (
                  <div key={task.id} className="tx-task-row">
                    <div className="tx-task-left">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                      />
                      <span>{task.title}</span>
                    </div>
                    <div className="tx-task-right">
                      <span className="tx-pill">Main</span>
                      <details className="body-menu">
                        <summary>•••</summary>
                        <div className="body-menu-panel">
                          <button type="button" onClick={async () => { if (!task.id) return; await updateGeneralTaskPriority(task.id, "secondary"); }}>
                            Move to Secondary
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

          <TitanButton onClick={() => setIsAddingTask(true)} compact className="mt-4">
            Add Task
          </TitanButton>
        </TitanPanel>
      </div>

      <MobileModal open={isAddingTask} onClose={() => { setIsAddingTask(false); setNewTaskTitle(""); }} title="New General Task">
            <TitanPanelHeader
              kicker="New General Task"
              rightSlot={
                <TitanButton tone="ghost" compact onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }}>
                  Close
                </TitanButton>
              }
            />
            <div className="mt-4 space-y-4">
              <div>
                <label className="tx-label">Title</label>
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  className="tx-input"
                  placeholder="Task title"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                />
              </div>
              <div>
                <label className="tx-label">Priority</label>
                <select value={newTaskPriority} onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")} className="tx-select">
                  <option value="main">Main (2 pts)</option>
                  <option value="secondary">Secondary (1 pt)</option>
                </select>
              </div>
              <div>
                <label className="tx-label">How many days per week?</label>
                <p className="tx-muted mb-1" style={{ fontSize: "0.75rem" }}>
                  Set less than 7 if you take rest days — skipping won&apos;t hurt your score once the weekly goal is met.
                </p>
                <select
                  value={newTaskDaysPerWeek}
                  onChange={(event) => setNewTaskDaysPerWeek(Number(event.target.value))}
                  className="tx-select"
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
              <TitanButton onClick={handleAddTask}>Create</TitanButton>
              <TitanButton tone="ghost" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }}>Cancel</TitanButton>
            </div>
      </MobileModal>
    </main>
  );
}
