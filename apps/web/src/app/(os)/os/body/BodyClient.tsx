"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { MobileModal } from "../../../../components/ui/MobileModal";
import { db } from "../../../../lib/db";
import {
  addBodyTask,
  deleteBodyTask,
  ensureBodyMeta,
  getBodyScoreMapForRange,
  toggleBodyTaskForDate,
  updateBodyTaskPriority,
} from "../../../../lib/body";
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
  TitanButton,
  TitanPageHeader,
  TitanPanel,
  TitanPanelHeader,
  TitanProgress,
} from "@/components/ui/titan-primitives";
import type { BodyTask } from "@/lib/db";

type BodyTaskWithCompletion = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  completed: boolean;
};

const EMPTY_TASKS: BodyTask[] = [];
const EMPTY_SCORE_MAP: Record<string, number> = {};

type TaskBucketCardProps = {
  title: string;
  dateLabel: string;
  emptyMessage: string;
  tagLabel: string;
  moveLabel: string;
  tasks: BodyTaskWithCompletion[];
  hasAnyTasks: boolean;
  onAdd: () => void;
  onToggle: (task: BodyTaskWithCompletion) => void;
  onMove: (task: BodyTaskWithCompletion) => Promise<void>;
  onDelete: (task: BodyTaskWithCompletion) => Promise<void>;
};


function TaskBucketCard({
  title,
  dateLabel,
  emptyMessage,
  tagLabel,
  moveLabel,
  tasks,
  hasAnyTasks,
  onAdd,
  onToggle,
  onMove,
  onDelete,
}: TaskBucketCardProps) {
  return (
    <TitanPanel tone="subtle">
      <TitanPanelHeader kicker={title} rightSlot={<p className="tx-muted">{dateLabel}</p>} />

      {!hasAnyTasks && tasks.length === 0 ? (
        <div className="tx-task-empty mt-4">
          <p>{emptyMessage}</p>
          <TitanButton className="mt-3" compact onClick={onAdd}>
            Add Task
          </TitanButton>
        </div>
      ) : (
        <div className="tx-task-list">
          {tasks.length === 0 ? (
            <div className="tx-task-empty">No tasks in this bucket.</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="tx-task-row">
                <label className="tx-task-left">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggle(task)}
                    className="h-4 w-4 accent-white"
                  />
                  <span>{task.title}</span>
                </label>
                <div className="tx-task-right">
                  <span className="tx-pill">{tagLabel}</span>
                  <details className="body-menu">
                    <summary>•••</summary>
                    <div className="body-menu-panel tx-menu-panel">
                      <button type="button" onClick={() => onMove(task)}>
                        {moveLabel}
                      </button>
                      <button type="button" onClick={() => onDelete(task)}>
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

      <TitanButton className="mt-4" compact onClick={onAdd}>
        Add Task
      </TitanButton>
    </TitanPanel>
  );
}

export default function BodyClient() {
  const pathname = usePathname();
  const todayKey = React.useMemo(() => todayISO(), []);

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("body.selectedDateISO") : null;
    if (!stored) return;
    try {
      setSelectedDateKey(assertDateISO(stored));
    } catch (err) {
      console.error(err);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("body.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

  React.useEffect(() => {
    ensureBodyMeta(selectedDateKey).catch(console.error);
  }, [selectedDateKey]);

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

  const tasks = useLiveQuery(() => db.body_tasks.toArray(), []) ?? EMPTY_TASKS;
  const bodyLog = useLiveQuery(
    () => db.body_logs.where("dateKey").equals(selectedDateKey).first(),
    [selectedDateKey],
  );
  const completedIds = React.useMemo(() => new Set(bodyLog?.completedTaskIds ?? []), [bodyLog]);

  const bodyMeta = useLiveQuery(() => db.body_meta.get("body"), []);
  const bodyStartDateKey = bodyMeta?.startDate ?? "";

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);
  const monthEndKey = React.useMemo(
    () => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1),
    [visibleMonth],
  );
  const monthScoreMap =
    useLiveQuery(
      () => getBodyScoreMapForRange(monthStartKey, monthEndKey),
      [monthStartKey, monthEndKey],
    ) ?? EMPTY_SCORE_MAP;

  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    try {
      setSelectedDateKey(assertDateISO(nextDateKey));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
  }

  const tasksWithCompletion: BodyTaskWithCompletion[] = React.useMemo(
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
    () => computeMonthConsistency(monthScoreMap, monthStartKey, monthEndKey, bodyStartDateKey, selectedDateKey),
    [monthScoreMap, monthStartKey, monthEndKey, bodyStartDateKey, selectedDateKey],
  );

  async function handleToggleTask(task: BodyTaskWithCompletion) {
    if (!task.id) return;
    await toggleBodyTaskForDate(selectedDateKey, task.id);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    await addBodyTask(title, newTaskPriority, newTaskDaysPerWeek);
    setNewTaskTitle("");
    setNewTaskPriority("main");
    setNewTaskDaysPerWeek(7);
    setIsAddingTask(false);
  }

  async function handleMove(task: BodyTaskWithCompletion, priority: "main" | "secondary") {
    if (!task.id) return;
    await updateBodyTaskPriority(task.id, priority);
  }

  async function handleDelete(task: BodyTaskWithCompletion) {
    if (!task.id) return;
    await deleteBodyTask(task.id);
  }

  return (
    <main className="tx-body-page w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="tx-body-top">
        <TitanPageHeader
          className="mb-0"
          kicker="Body Engine"
          title="Body Control"
          subtitle={`Daily performance log · ${selectedDateKey}`}
          rightSlot={
            <div className="tx-date-pill">
              <span className="tx-kicker">Selected</span>
              <input type="date" value={selectedDateKey} onChange={(event) => handleDateChange(event.target.value)} />
            </div>
          }
        />

        <TitanPanel tone="hero">
          <p className="tx-kicker">Day Score</p>
          <p className="tx-score-main tx-display">{score.percent}%</p>
          <p className="tx-score-label">
            Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal} • Points{" "}
            {score.pointsDone}/{score.pointsTotal}
          </p>
          <TitanProgress className="mt-3" value={score.percent} />
        </TitanPanel>
      </div>

      <div className="tx-tabs">
        <Link href="/os/body" className={`tx-tab ${pathname === "/os/body" ? "is-active" : ""}`}>
          Body Engine
        </Link>
        <Link href="/os/body/nutrition" className={`tx-tab ${pathname?.startsWith("/os/body/nutrition") ? "is-active" : ""}`}>
          Nutrition
        </Link>
        <Link href="/os/body/workouts" className={`tx-tab ${pathname?.startsWith("/os/body/workouts") ? "is-active" : ""}`}>
          Workouts
        </Link>
        <Link href="/os/body/weight" className={`tx-tab ${pathname?.startsWith("/os/body/weight") ? "is-active" : ""}`}>
          Weight
        </Link>
        <Link href="/os/body/sleep" className={`tx-tab ${pathname?.startsWith("/os/body/sleep") ? "is-active" : ""}`}>
          Sleep
        </Link>
      </div>

      <div className="tx-body-grid">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={handleDateChange}
          startDateKey={bodyStartDateKey}
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          scoreMap={monthScoreMap}
          referenceDateKey={selectedDateKey}
        />

        <TitanPanel tone="subtle">
          <TitanPanelHeader kicker="Consistency" />
          <p className="tx-score-main tx-display">{consistency.consistencyPct}%</p>
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
              visibleMonth={visibleMonth}
              scoreMap={monthScoreMap}
              startDateKey={bodyStartDateKey}
              todayKey={selectedDateKey}
            />
          </div>
        </TitanPanel>
      </div>

      <div className="tx-body-tasks">
        <TaskBucketCard
          title="Secondary Tasks"
          dateLabel={selectedDateKey}
          emptyMessage="No secondary tasks for this date."
          tagLabel="Secondary"
          moveLabel="Move to Main"
          tasks={secondaryTasks}
          hasAnyTasks={hasTasks}
          onAdd={() => setIsAddingTask(true)}
          onToggle={handleToggleTask}
          onMove={(task) => handleMove(task, "main")}
          onDelete={handleDelete}
        />

        <TaskBucketCard
          title="Main Tasks"
          dateLabel={selectedDateKey}
          emptyMessage="No main tasks for this date."
          tagLabel="Main"
          moveLabel="Move to Secondary"
          tasks={mainTasks}
          hasAnyTasks={hasTasks}
          onAdd={() => setIsAddingTask(true)}
          onToggle={handleToggleTask}
          onMove={(task) => handleMove(task, "secondary")}
          onDelete={handleDelete}
        />
      </div>

      <MobileModal open={isAddingTask} onClose={() => { setIsAddingTask(false); setNewTaskTitle(""); }} title="New Task">
            <TitanPanelHeader
              kicker="New Task"
              rightSlot={
                <TitanButton
                  tone="ghost"
                  compact
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle("");
                  }}
                >
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
                <select
                  value={newTaskPriority}
                  onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")}
                  className="tx-select"
                >
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
              <TitanButton
                tone="ghost"
                onClick={() => {
                  setIsAddingTask(false);
                  setNewTaskTitle("");
                }}
              >
                Cancel
              </TitanButton>
            </div>
      </MobileModal>
    </main>
  );
}
