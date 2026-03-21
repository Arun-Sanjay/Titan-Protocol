"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { MobileModal } from "../../../../components/ui/MobileModal";
import { MobileSubNav, ENGINE_TABS } from "../../components/MobileSubNav";
import { db } from "../../../../lib/db";
import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";
import {
  addDaysISO,
  assertDateISO,
  dateFromISO,
  dateToISO,
  monthBounds,
  todayISO,
} from "../../../../lib/date";
import { computeMonthConsistency } from "../../../../lib/scoring";
import {
  addMindTask,
  deleteMindTask,
  ensureMindMeta,
  getMindScoreMapForRange,
  setMindTaskCompletion,
  updateMindTaskKind,
} from "../../../../lib/mind";


export default function MindClient() {
  const pathname = usePathname();
  const todayKey = React.useMemo(() => todayISO(), []);

  // --- UI state ---
  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskKind, setNewTaskKind] = React.useState<"main" | "secondary">("main");
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [creatingTask, setCreatingTask] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // --- Persist selected date ---
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("mind.selectedDateISO") : null;
    if (!stored) return;
    try {
      setSelectedDateKey(assertDateISO(stored));
    } catch (err) {
      console.error(err);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mind.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

  // --- Ensure meta ---
  React.useEffect(() => {
    ensureMindMeta(selectedDateKey).catch(console.error);
  }, [selectedDateKey]);

  const handleSelectDate = React.useCallback((next: string) => {
    if (!next) return;
    try {
      setSelectedDateKey(assertDateISO(next));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
  }, []);

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
  const allTasks = useLiveQuery(() => db.mind_tasks.toArray(), []) ?? [];
  const tasks = React.useMemo(() => allTasks.filter((t) => t.isActive !== false), [allTasks]);

  const completions =
    useLiveQuery(
      () => db.mind_task_completions.where("dateKey").equals(selectedDateKey).toArray(),
      [selectedDateKey],
    ) ?? [];
  const completedIds = React.useMemo(
    () => new Set(completions.filter((c) => c.completed).map((c) => c.taskId)),
    [completions],
  );

  const mindMeta = useLiveQuery(() => db.mind_meta.get("mind"), []);
  const mindStartDateKey = mindMeta?.startDate ?? "";

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);

  const monthScoreMap =
    useLiveQuery(
      () => getMindScoreMapForRange(monthStartKey),
      [monthStartKey],
    ) ?? ({} as Record<string, number>);

  // --- Derived ---
  const tasksWithCompletion = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id) })),
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

  const monthEndKey = React.useMemo(
    () => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1),
    [visibleMonth],
  );
  const referenceKey = selectedDateKey;

  const consistency = React.useMemo(
    () => computeMonthConsistency(monthScoreMap, monthStartKey, monthEndKey, mindStartDateKey, referenceKey),
    [monthScoreMap, monthStartKey, monthEndKey, mindStartDateKey, referenceKey],
  );

  // --- Mutation handlers ---
  async function handleToggleTask(task: (typeof tasks)[number]) {
    const nextCompleted = !completedIds.has(task.id);
    await setMindTaskCompletion(selectedDateKey, task.id, nextCompleted);
  }

  async function handleDeleteTask(taskId: string) {
    if (!taskId) return;
    try {
      await deleteMindTask(taskId);
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
      setNewTaskTitle("");
      setNewTaskKind("main");
      setIsAddingTask(false);
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <MobileSubNav tabs={ENGINE_TABS} />
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

      <div className="mt-4 flex items-center justify-between">
        <div className="tp-tabs">
          <Link href="/os/mind" className={`tp-tab ${pathname === "/os/mind" ? "is-active" : ""}`}>
            Mind Engine
          </Link>
          <Link
            href="/os/focus"
            className={`tp-tab ${pathname?.startsWith("/os/focus") ? "is-active" : ""}`}
          >
            Focus Timer
          </Link>
        </div>
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
                        <button type="button" onClick={async () => { await updateMindTaskKind(task.id, "main"); }}>
                          Move to Main
                        </button>
                        <button type="button" onClick={() => handleDeleteTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setIsAddingTask(true)} className="tp-button mt-4 inline-flex w-auto px-4">
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
                        <button type="button" onClick={async () => { await updateMindTaskKind(task.id, "secondary"); }}>
                          Move to Secondary
                        </button>
                        <button type="button" onClick={() => handleDeleteTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setIsAddingTask(true)} className="tp-button mt-4 inline-flex w-auto px-4">
            + Add Task
          </button>
        </section>
      </div>

      <MobileModal open={isAddingTask} onClose={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }} title="New Mind Task">
            <div className="tp-panel-head">
              <p className="tp-kicker">New Mind Task</p>
              <button
                type="button"
                onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }}
                className="tp-button tp-button-inline"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="body-label">Title</label>
                <input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} className="body-input" placeholder="Task title" />
              </div>
              <div>
                <label className="body-label">Priority</label>
                <select value={newTaskKind} onChange={(event) => setNewTaskKind(event.target.value as "main" | "secondary")} className="body-select">
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
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">
                {creatingTask ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); setCreateError(null); }} className="tp-button w-auto px-4">
                Cancel
              </button>
            </div>
      </MobileModal>
    </main>
  );
}
