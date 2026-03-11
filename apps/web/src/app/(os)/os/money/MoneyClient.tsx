"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { db, type MoneyTask } from "../../../../lib/db";
import {
  addMoneyTask,
  deleteMoneyTask,
  ensureMoneyMeta,
  getMoneyScoreMapForRange,
  toggleMoneyTaskForDate,
  updateMoneyTaskPriority,
} from "../../../../lib/money";
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

type MoneyTaskWithCompletion = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  completed: boolean;
};

function buildScore(tasks: MoneyTaskWithCompletion[]) {
  const main = tasks.filter((t) => t.priority === "main");
  const secondary = tasks.filter((t) => t.priority === "secondary");
  const mainDone = main.filter((t) => t.completed).length;
  const secondaryDone = secondary.filter((t) => t.completed).length;
  const mainTotal = main.length;
  const secondaryTotal = secondary.length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);
  return { percent, mainDone, mainTotal, secondaryDone, secondaryTotal, pointsDone, pointsTotal };
}


const EMPTY_TASKS: MoneyTask[] = [];
const EMPTY_SCORE_MAP: Record<string, number> = {};

export default function MoneyClient() {
  const pathname = usePathname();
  const todayKey = React.useMemo(() => todayISO(), []);

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => dateFromISO(monthBounds(todayKey).start));
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [newTaskDaysPerWeek, setNewTaskDaysPerWeek] = React.useState<number>(7);
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.selectedDateISO") : null;
    if (!stored) return;
    try { setSelectedDateKey(assertDateISO(stored)); } catch (err) { console.error(err); }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("money.selectedDateISO", selectedDateKey);
  }, [selectedDateKey]);

  React.useEffect(() => {
    ensureMoneyMeta(selectedDateKey).catch(console.error);
  }, [selectedDateKey]);

  React.useEffect(() => {
    if (!selectedDateKey) return;
    let safeDate: string;
    try { safeDate = assertDateISO(selectedDateKey); } catch (err) { console.error(err); return; }
    const selectedMonthStart = monthBounds(safeDate).start;
    const visibleMonthStart = monthBounds(dateToISO(visibleMonth)).start;
    if (selectedMonthStart !== visibleMonthStart) {
      setVisibleMonth(dateFromISO(selectedMonthStart));
    }
  }, [selectedDateKey, visibleMonth]);

  const tasks = useLiveQuery(() => db.money_tasks.toArray(), []) ?? EMPTY_TASKS;
  const moneyLog = useLiveQuery(
    () => db.money_logs.where("dateKey").equals(selectedDateKey).first(),
    [selectedDateKey],
  );
  const completedIds = React.useMemo(() => new Set(moneyLog?.completedTaskIds ?? []), [moneyLog]);

  const moneyMeta = useLiveQuery(() => db.money_meta.get("money"), []);
  const moneyStartDateKey = moneyMeta?.startDate ?? "";

  const monthStartKey = React.useMemo(() => monthBounds(dateToISO(visibleMonth)).start, [visibleMonth]);
  const monthEndKey = React.useMemo(
    () => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1),
    [visibleMonth],
  );
  const monthScoreMap =
    useLiveQuery(
      () => getMoneyScoreMapForRange(monthStartKey, monthEndKey),
      [monthStartKey, monthEndKey],
    ) ?? EMPTY_SCORE_MAP;

  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    try { setSelectedDateKey(assertDateISO(nextDateKey)); }
    catch (err) { console.error(err); setSelectedDateKey(todayISO()); }
  }

  const tasksWithCompletion: MoneyTaskWithCompletion[] = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id ?? -1) })),
    [completedIds, tasks],
  );

  const mainTasks = tasksWithCompletion.filter((t) => t.priority === "main");
  const secondaryTasks = tasksWithCompletion.filter((t) => t.priority === "secondary");
  const hasTasks = tasks.length > 0;
  const score = buildScore(tasksWithCompletion);

  const consistency = React.useMemo(
    () => computeMonthConsistency(monthScoreMap, monthStartKey, monthEndKey, moneyStartDateKey, selectedDateKey),
    [monthScoreMap, monthStartKey, monthEndKey, moneyStartDateKey, selectedDateKey],
  );

  async function handleToggleTask(task: MoneyTaskWithCompletion) {
    if (!task.id) return;
    await toggleMoneyTaskForDate(selectedDateKey, task.id);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    await addMoneyTask(title, newTaskPriority, newTaskDaysPerWeek);
    setNewTaskTitle("");
    setNewTaskPriority("main");
    setNewTaskDaysPerWeek(7);
    setIsAddingTask(false);
  }

  async function handleMove(task: MoneyTaskWithCompletion, priority: "main" | "secondary") {
    if (!task.id) return;
    await updateMoneyTaskPriority(task.id, priority);
  }

  async function handleDelete(task: MoneyTaskWithCompletion) {
    if (!task.id) return;
    await deleteMoneyTask(task.id);
  }

  return (
    <main className="tx-body-page w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="tx-body-top">
        <TitanPageHeader
          className="mb-0"
          kicker="Money Engine"
          title="Deep Work"
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
        <Link href="/os/money" className={`tx-tab ${pathname === "/os/money" ? "is-active" : ""}`}>
          Deep Work
        </Link>
        <Link href="/os/money/cashflow" className={`tx-tab ${pathname?.startsWith("/os/money/cashflow") ? "is-active" : ""}`}>
          Expense Tracker
        </Link>
        <Link href="/os/money/budgets" className={`tx-tab ${pathname?.startsWith("/os/money/budgets") ? "is-active" : ""}`}>
          Budgets
        </Link>
      </div>

      <div className="tx-body-grid">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={handleDateChange}
          startDateKey={moneyStartDateKey}
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
              startDateKey={moneyStartDateKey}
              todayKey={selectedDateKey}
            />
          </div>
        </TitanPanel>
      </div>

      <div className="tx-body-tasks">
        {/* Secondary Tasks */}
        <TitanPanel tone="subtle">
          <TitanPanelHeader kicker="Secondary Tasks" rightSlot={<p className="tx-muted">{selectedDateKey}</p>} />
          {!hasTasks && secondaryTasks.length === 0 ? (
            <div className="tx-task-empty mt-4">
              <p>No secondary tasks yet.</p>
              <TitanButton className="mt-3" compact onClick={() => setIsAddingTask(true)}>
                Add Task
              </TitanButton>
            </div>
          ) : (
            <div className="tx-task-list">
              {secondaryTasks.length === 0 ? (
                <div className="tx-task-empty">No tasks in this bucket.</div>
              ) : (
                secondaryTasks.map((task) => (
                  <div key={task.id} className="tx-task-row">
                    <label className="tx-task-left">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                        className="h-4 w-4 accent-white"
                      />
                      <span className={task.completed ? "line-through text-white/40" : ""}>{task.title}</span>
                    </label>
                    <div className="tx-task-right">
                      <span className="tx-pill">Secondary</span>
                      <details className="body-menu">
                        <summary>•••</summary>
                        <div className="body-menu-panel tx-menu-panel">
                          <button type="button" onClick={() => handleMove(task, "main")}>Move to Main</button>
                          <button type="button" onClick={() => handleDelete(task)}>Delete</button>
                        </div>
                      </details>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <TitanButton className="mt-4" compact onClick={() => setIsAddingTask(true)}>
            Add Task
          </TitanButton>
        </TitanPanel>

        {/* Main / Deep Work Tasks */}
        <TitanPanel tone="subtle">
          <TitanPanelHeader kicker="Deep Work Tasks" rightSlot={<p className="tx-muted">{selectedDateKey}</p>} />
          {!hasTasks && mainTasks.length === 0 ? (
            <div className="tx-task-empty mt-4">
              <p>No deep work tasks yet. Add tasks like "Work on business" to track your focused work.</p>
              <TitanButton className="mt-3" compact onClick={() => setIsAddingTask(true)}>
                Add Task
              </TitanButton>
            </div>
          ) : (
            <div className="tx-task-list">
              {mainTasks.length === 0 ? (
                <div className="tx-task-empty">No main tasks.</div>
              ) : (
                mainTasks.map((task) => (
                  <div key={task.id} className="tx-task-row">
                    <label className="tx-task-left">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                        className="h-4 w-4 accent-white"
                      />
                      <span className={task.completed ? "line-through text-white/40" : ""}>{task.title}</span>
                    </label>
                    <div className="tx-task-right">
                      {task.completed && <span className="tx-pill" style={{ color: "rgba(134,239,172,0.9)" }}>Done</span>}
                      {!task.completed && <span className="tx-pill">Main · 2 pts</span>}
                      <details className="body-menu">
                        <summary>•••</summary>
                        <div className="body-menu-panel tx-menu-panel">
                          <button type="button" onClick={() => handleMove(task, "secondary")}>Move to Secondary</button>
                          <button type="button" onClick={() => handleDelete(task)}>Delete</button>
                        </div>
                      </details>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <TitanButton className="mt-4" compact onClick={() => setIsAddingTask(true)}>
            Add Task
          </TitanButton>
        </TitanPanel>
      </div>

      {isAddingTask ? (
        <div className="tx-modal">
          <div className="tx-modal-panel">
            <TitanPanelHeader
              kicker="New Deep Work Task"
              rightSlot={
                <TitanButton
                  tone="ghost"
                  compact
                  onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }}
                >
                  Close
                </TitanButton>
              }
            />
            <div className="mt-4 space-y-4">
              <div>
                <label className="tx-label">Task Title</label>
                <input
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  className="tx-input"
                  placeholder='e.g. "Work on business"'
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
                  <option value="main">Main · Deep Work (2 pts)</option>
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
                onClick={() => { setIsAddingTask(false); setNewTaskTitle(""); }}
              >
                Cancel
              </TitanButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
