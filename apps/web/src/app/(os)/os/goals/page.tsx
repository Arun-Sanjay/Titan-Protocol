"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Goal, type GoalTask } from "../../../../lib/db";
import { todayISO } from "../../../../lib/date";
import { MobileSubNav, TRACK_TABS } from "../../components/MobileSubNav";
import {
  listGoals,
  addGoal,
  deleteGoal,
  computeGoalProgress,
  addGoalTask,
  toggleGoalTask,
  toggleDailyGoalTask,
  deleteGoalTask,
  listGoalTasksForGoal,
  type GoalProgress,
} from "../../../../lib/goals";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<string, string> = {
  body: "Body",
  mind: "Mind",
  money: "Money",
  general: "General",
};

const ENGINE_OPTIONS = [
  { value: "body", label: "Body" },
  { value: "mind", label: "Mind" },
  { value: "money", label: "Money" },
  { value: "general", label: "General" },
] as const;

// SVG circle constants for progress ring
const RING_SIZE = 60;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysRemaining(deadline: string): number {
  const today = new Date(todayISO());
  const dl = new Date(deadline);
  const diff = dl.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Enriched task type (GoalTask + isDoneToday from engine logs)
// ---------------------------------------------------------------------------

type EnrichedTask = GoalTask & { isDoneToday: boolean };

// ---------------------------------------------------------------------------
// Progress Ring Component
// ---------------------------------------------------------------------------

function ProgressRing({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = RING_CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="rotate-[-90deg]"
      >
        {/* background track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={RING_STROKE}
        />
        {/* progress arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="#34d399"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white/90 leading-none text-center px-0.5">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Task Row
// ---------------------------------------------------------------------------

function GoalTaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: EnrichedTask;
  onToggle: (task: EnrichedTask) => void;
  onDelete: (id: number) => void;
}) {
  const isDaily = (task.taskType ?? "once") === "daily";
  const isDone = isDaily ? task.isDoneToday : task.completed;

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] group transition-colors">
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => onToggle(task)}
        className="h-3.5 w-3.5 accent-emerald-400 shrink-0"
      />
      <span
        className={`flex-1 text-xs ${
          isDone ? "line-through text-white/30" : "text-white/75"
        }`}
      >
        {task.title}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        {isDaily ? (
          <span
            className="tx-pill shrink-0"
            style={{ fontSize: "8px", letterSpacing: "0.1em", background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)", color: "#34d399" }}
            title="Repeats daily"
          >
            ↻ Daily
          </span>
        ) : (
          <span
            className="tx-pill shrink-0"
            style={{ fontSize: "8px", letterSpacing: "0.1em" }}
            title="One-time task"
          >
            Once
          </span>
        )}
        {task.engine && (
          <span className="tx-pill shrink-0" style={{ fontSize: "8px", letterSpacing: "0.1em" }}>
            {ENGINE_LABELS[task.engine]}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => task.id !== undefined && onDelete(task.id)}
        className="shrink-0 text-white/20 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
        title="Remove task"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Task Inline Form
// ---------------------------------------------------------------------------

function AddTaskForm({ goalId }: { goalId: number }) {
  const [title, setTitle] = React.useState("");
  const [taskType, setTaskType] = React.useState<"daily" | "once">("daily");
  const [engine, setEngine] = React.useState<string>("body");
  const [adding, setAdding] = React.useState(false);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const eng = taskType === "daily" && engine
        ? (engine as "body" | "mind" | "money" | "general")
        : null;
      await addGoalTask(goalId, trimmed, taskType, eng);
      setTitle("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="Add a task…"
          className="flex-1 bg-transparent text-xs text-white/70 placeholder:text-white/25 border border-white/10 rounded-lg px-3 py-1.5 outline-none focus:border-white/25 transition-colors"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !title.trim()}
          className="shrink-0 text-[11px] font-semibold text-white/60 hover:text-white disabled:opacity-30 border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 transition-colors"
        >
          Add
        </button>
      </div>

      {/* Type + Engine row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Task type */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white/55">
            <input
              type="radio"
              name={`taskType-${goalId}`}
              value="daily"
              checked={taskType === "daily"}
              onChange={() => setTaskType("daily")}
              className="accent-emerald-400"
            />
            <span>Daily</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white/55">
            <input
              type="radio"
              name={`taskType-${goalId}`}
              value="once"
              checked={taskType === "once"}
              onChange={() => setTaskType("once")}
              className="accent-emerald-400"
            />
            <span>One-time</span>
          </label>
        </div>

        {/* Engine selector — only shown for daily tasks */}
        {taskType === "daily" && (
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="bg-black/60 text-white/55 text-[11px] border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-white/25 transition-colors"
          >
            {ENGINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Card Component
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  progress,
  onDelete,
}: {
  goal: Goal;
  progress: GoalProgress | null;
  onDelete: (id: number) => void;
}) {
  // Enrich tasks with today's engine-log state for daily tasks
  const enrichedTasks: EnrichedTask[] = useLiveQuery(
    async () => {
      if (goal.id === undefined) return [];
      const tasks = await listGoalTasksForGoal(goal.id);
      if (!tasks.length) return [];

      const today = todayISO();

      // Fetch all engine logs for today in parallel (useLiveQuery tracks all these reads)
      const [bodyLog, moneyLog, generalLog, mindDone] = await Promise.all([
        db.body_logs.where("dateKey").equals(today).first(),
        db.money_logs.where("dateKey").equals(today).first(),
        db.general_logs.where("dateKey").equals(today).first(),
        db.mind_task_completions.where("dateKey").equals(today).toArray(),
      ]);

      return tasks.map((t): EnrichedTask => {
        const type = t.taskType ?? "once";
        if (type === "once") return { ...t, isDoneToday: t.completed };

        // Daily task — check today's engine log
        let done = false;
        if (t.engineTaskRefId && t.engine) {
          switch (t.engine) {
            case "body":
              done = bodyLog?.completedTaskIds.includes(Number(t.engineTaskRefId)) ?? false;
              break;
            case "money":
              done = moneyLog?.completedTaskIds.includes(Number(t.engineTaskRefId)) ?? false;
              break;
            case "general":
              done = generalLog?.completedTaskIds.includes(Number(t.engineTaskRefId)) ?? false;
              break;
            case "mind":
              done = mindDone.some(
                (c) => c.taskId === t.engineTaskRefId && c.completed,
              );
              break;
          }
        }
        return { ...t, isDoneToday: done };
      });
    },
    [goal.id],
  ) ?? [];

  const days = daysRemaining(goal.deadline);
  const hasTasks = enrichedTasks.length > 0;

  // Progress: task-based if tasks exist, otherwise use computed metric progress
  const doneCount = enrichedTasks.filter((t) => t.isDoneToday).length;
  const ringPercent = hasTasks
    ? Math.round((doneCount / enrichedTasks.length) * 100)
    : (progress?.percent ?? 0);

  const ringLabel = hasTasks
    ? `${doneCount}/${enrichedTasks.length}`
    : `${ringPercent}%`;

  const isCompleted = ringPercent >= 100;
  const isExpired = days < 0 && !isCompleted;

  async function handleToggle(task: EnrichedTask) {
    if ((task.taskType ?? "once") === "once") {
      if (task.id !== undefined) toggleGoalTask(task.id);
    } else {
      toggleDailyGoalTask(task, task.isDoneToday);
    }
  }

  function handleDeleteTask(id: number) {
    deleteGoalTask(id);
  }

  return (
    <div className="tp-panel p-4">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <ProgressRing percent={ringPercent} label={ringLabel} />

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white/90">{goal.title}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/40 flex-wrap">
            {isCompleted ? (
              <span className="text-emerald-400 font-medium">Completed ✓</span>
            ) : isExpired ? (
              <span className="text-red-400 font-medium">Expired</span>
            ) : (
              <span>
                {days} day{days !== 1 ? "s" : ""} left
              </span>
            )}
            <span className="text-white/20">·</span>
            <span>Due {goal.deadline}</span>
            {hasTasks && (
              <>
                <span className="text-white/20">·</span>
                <span>
                  {doneCount}/{enrichedTasks.length} done today
                </span>
              </>
            )}
          </div>
        </div>

        {/* Delete goal */}
        <button
          type="button"
          onClick={() => {
            if (goal.id !== undefined) onDelete(goal.id);
          }}
          className="shrink-0 text-white/25 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded border border-transparent hover:border-red-400/30"
          title="Delete goal"
        >
          Delete
        </button>
      </div>

      {/* Task list */}
      <div className="mt-3">
        {enrichedTasks.map((task) => (
          <GoalTaskRow
            key={task.id}
            task={task}
            onToggle={handleToggle}
            onDelete={handleDeleteTask}
          />
        ))}
        {enrichedTasks.length === 0 && (
          <p className="text-xs text-white/25 px-2 pb-1">No tasks yet — add one below.</p>
        )}
        {goal.id !== undefined && <AddTaskForm goalId={goal.id} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Goal Modal
// ---------------------------------------------------------------------------

function AddGoalModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const canSave = title.trim().length > 0 && deadline.length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await addGoal({
        title: title.trim(),
        engine: "all",
        type: "count",
        target: 0,
        unit: "tasks",
        deadline,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="body-modal" onClick={onClose}>
      <div className="body-modal-panel" onClick={(e) => e.stopPropagation()}>
        <p className="tp-kicker">New Goal</p>
        <h2 className="text-lg font-bold text-white/90 mt-1">Add Goal</h2>

        <div className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="body-label">Goal title</label>
            <input
              type="text"
              className="body-input"
              placeholder='e.g. "Get lean"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) handleSave();
              }}
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="body-label">Deadline</label>
            <input
              type="date"
              className="body-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] text-white/30">
          After creating the goal you can add tasks. Daily tasks sync with your engine pages.
        </p>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="tp-button inline-flex w-auto px-6 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Create Goal"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="tp-button tp-button-inline inline-flex w-auto px-5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GoalsPage() {
  const [showModal, setShowModal] = React.useState(false);
  const [showArchive, setShowArchive] = React.useState(false);

  // Fetch all goals reactively
  const goals = useLiveQuery(() => listGoals(), []);

  // Compute metric-based progress for goals that have no tasks
  // (for goals with tasks, GoalCard handles it internally via useLiveQuery)
  const [progressMap, setProgressMap] = React.useState<Record<number, GoalProgress>>({});

  React.useEffect(() => {
    if (!goals || goals.length === 0) {
      setProgressMap({});
      return;
    }
    let cancelled = false;
    async function compute() {
      const map: Record<number, GoalProgress> = {};
      for (const g of goals!) {
        if (g.id === undefined) continue;
        try {
          map[g.id] = await computeGoalProgress(g);
        } catch {
          map[g.id] = { current: 0, target: g.target, percent: 0 };
        }
      }
      if (!cancelled) setProgressMap(map);
    }
    compute();
    return () => {
      cancelled = true;
    };
  }, [goals]);

  // Partition goals into active vs archived
  const today = todayISO();
  const active: Goal[] = [];
  const archived: Goal[] = [];

  for (const g of goals ?? []) {
    if (g.id === undefined) continue;
    const prog = progressMap[g.id];
    const isCompleted = (prog?.percent ?? 0) >= 100;
    const isExpired = g.deadline < today && !isCompleted;
    if (isCompleted || isExpired) {
      archived.push(g);
    } else {
      active.push(g);
    }
  }

  function handleDelete(id: number) {
    deleteGoal(id);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <MobileSubNav tabs={TRACK_TABS} />
      {/* Header */}
      <header>
        <p className="tp-kicker">Targets &amp; Progress</p>
        <h1 className="tp-title text-3xl font-bold md:text-4xl">GOALS</h1>
        <p className="mt-1 text-sm text-white/40">
          Create goals, add tasks to achieve them. Daily tasks sync with engine pages for two-way tracking.
        </p>
      </header>

      {/* Add Goal button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="tp-button inline-flex w-auto px-6"
        >
          + Add Goal
        </button>
      </div>

      {/* Active Goals */}
      <section className="mt-6 space-y-4">
        {active.length === 0 && (
          <div className="body-empty">
            No active goals yet. Add one to start tracking your progress.
          </div>
        )}
        {active.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            progress={g.id !== undefined ? progressMap[g.id] ?? null : null}
            onDelete={handleDelete}
          />
        ))}
      </section>

      {/* Archived Goals */}
      {archived.length > 0 && (
        <section className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="tp-button tp-button-inline inline-flex w-auto px-4 text-sm"
          >
            {showArchive ? "Hide" : "Show"} Completed / Expired ({archived.length})
          </button>

          {showArchive && (
            <div className="mt-3 space-y-4">
              {archived.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  progress={g.id !== undefined ? progressMap[g.id] ?? null : null}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal */}
      {showModal && <AddGoalModal onClose={() => setShowModal(false)} />}
    </main>
  );
}
