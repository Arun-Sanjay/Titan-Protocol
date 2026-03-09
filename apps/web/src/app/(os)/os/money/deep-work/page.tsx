"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";

import { db, type DeepWorkTask, type DeepWorkLog } from "../../../../../lib/db";
import { todayISO } from "../../../../../lib/date";
import { formatMoney, type MoneyCurrency } from "../../../../../lib/money_format";
import {
  listDeepWorkTasks,
  addDeepWorkTask,
  deleteDeepWorkTask,
  getDeepWorkLogsForDate,
  toggleDeepWorkCompletion,
  updateDeepWorkEarnings,
  getDeepWorkEarningsToday,
  getDeepWorkEarningsWeek,
} from "../../../../../lib/deepwork";

const CATEGORIES: DeepWorkTask["category"][] = [
  "Main Job / College",
  "Side Hustle",
  "Freelance",
  "Investments",
  "Other",
];

const EARNINGS_CATEGORIES = new Set<DeepWorkTask["category"]>(["Side Hustle", "Freelance"]);

export default function DeepWorkPage() {
  const pathname = usePathname();
  const todayKey = React.useMemo(() => todayISO(), []);

  /* ---- reactive data ---- */
  const tasks = useLiveQuery(() => listDeepWorkTasks(), []) ?? ([] as DeepWorkTask[]);
  const logs = useLiveQuery(() => getDeepWorkLogsForDate(todayKey), [todayKey]) ?? ([] as DeepWorkLog[]);
  const earningsToday = useLiveQuery(() => getDeepWorkEarningsToday(todayKey), [todayKey]) ?? 0;
  const earningsWeek = useLiveQuery(() => getDeepWorkEarningsWeek(todayKey), [todayKey]) ?? 0;

  /* ---- derived ---- */
  const logByTaskId = React.useMemo(() => {
    const map = new Map<number, DeepWorkLog>();
    logs.forEach((log) => map.set(log.taskId, log));
    return map;
  }, [logs]);

  const completedCount = React.useMemo(
    () => logs.filter((l) => l.completed).length,
    [logs],
  );

  /* ---- currency (mirrors MoneyClient localStorage key) ---- */
  const [currency, setCurrency] = React.useState<MoneyCurrency>("USD");

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("money.currency") : null;
    if (stored && (stored === "USD" || stored === "EUR" || stored === "GBP" || stored === "INR")) {
      setCurrency(stored as MoneyCurrency);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("money.currency", currency);
  }, [currency]);

  /* ---- local UI state ---- */
  const [showModal, setShowModal] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [draftCategory, setDraftCategory] = React.useState<DeepWorkTask["category"]>("Main Job / College");

  /* ---- local earnings cache so we don't fire on every keystroke ---- */
  const [earningsInputs, setEarningsInputs] = React.useState<Record<number, string>>({});

  // Sync earningsInputs with incoming logs when logs change
  React.useEffect(() => {
    const next: Record<number, string> = {};
    logs.forEach((log) => {
      if (log.earningsToday > 0) {
        next[log.id!] = String(log.earningsToday);
      }
    });
    setEarningsInputs(next);
  }, [logs]);

  /* ---- handlers ---- */
  async function handleAddTask() {
    const name = draftName.trim();
    if (!name) return;
    await addDeepWorkTask(name, draftCategory);
    setDraftName("");
    setDraftCategory("Main Job / College");
    setShowModal(false);
  }

  async function handleToggle(taskId: number) {
    await toggleDeepWorkCompletion(taskId, todayKey);
  }

  async function handleDelete(taskId: number) {
    if (!confirm("Delete this task and all its logs?")) return;
    await deleteDeepWorkTask(taskId);
  }

  function handleEarningsChange(logId: number, value: string) {
    setEarningsInputs((prev) => ({ ...prev, [logId]: value }));
  }

  async function handleEarningsBlur(logId: number) {
    const raw = earningsInputs[logId] ?? "";
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    await updateDeepWorkEarnings(logId, num);
  }

  /* ---- render ---- */
  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MONEY ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Deep Work</p>
        </div>
        <button
          type="button"
          className="tp-button tp-button-inline"
          onClick={() => setShowModal(true)}
        >
          + Add Task
        </button>
      </div>

      {/* Tab navigation */}
      <div className="tp-tabs mb-4">
        <Link
          href="/os/money"
          className={`tp-tab ${pathname === "/os/money" ? "is-active" : ""}`}
        >
          Cashflow
        </Link>
        <Link
          href="/os/money/deep-work"
          className={`tp-tab ${pathname?.startsWith("/os/money/deep-work") ? "is-active" : ""}`}
        >
          Deep Work
        </Link>
      </div>

      <div className="space-y-4">
        {/* Stats panel */}
        <div className="grid gap-4 sm:grid-cols-3">
          <section className="tp-panel p-4">
            <p className="tp-kicker">Today&apos;s Earnings</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(earningsToday, currency)}
            </p>
          </section>
          <section className="tp-panel p-4">
            <p className="tp-kicker">Weekly Earnings</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatMoney(earningsWeek, currency)}
            </p>
          </section>
          <section className="tp-panel p-4">
            <p className="tp-kicker">Completed Today</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {completedCount} / {tasks.length}
            </p>
          </section>
        </div>

        {/* Task list */}
        <section className="tp-panel p-4">
          <p className="tp-kicker">Tasks</p>
          <p className="tp-muted mt-1 text-xs">{todayKey}</p>

          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <div className="body-empty">No deep work tasks yet. Add one above.</div>
            ) : (
              tasks.map((task) => {
                const log = logByTaskId.get(task.id!);
                const isCompleted = log?.completed ?? false;
                const showEarnings = EARNINGS_CATEGORIES.has(task.category);

                return (
                  <div key={task.id} className="body-task-row">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => handleToggle(task.id!)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-400"
                      />
                      <div>
                        <p
                          className={`text-sm ${isCompleted ? "line-through text-white/40" : ""}`}
                        >
                          {task.taskName}
                        </p>
                        <span className="body-badge mt-1 inline-block text-[10px]">
                          {task.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {showEarnings && log ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="body-input w-[90px] text-right text-xs tabular-nums"
                          value={earningsInputs[log.id!] ?? ""}
                          onChange={(e) => handleEarningsChange(log.id!, e.target.value)}
                          onBlur={() => handleEarningsBlur(log.id!)}
                        />
                      ) : null}

                      <details className="body-menu">
                        <summary>...</summary>
                        <div className="body-menu-panel">
                          <button type="button" onClick={() => handleDelete(task.id!)}>
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Add task modal */}
      {showModal ? (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Add Deep Work Task</p>
              <button
                type="button"
                className="tp-button tp-button-inline"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="body-label">Task Name</label>
                <input
                  className="body-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Study algorithms"
                  autoFocus
                />
              </div>
              <div>
                <label className="body-label">Category</label>
                <select
                  className="body-select"
                  value={draftCategory}
                  onChange={(e) =>
                    setDraftCategory(e.target.value as DeepWorkTask["category"])
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  className="tp-button w-auto px-4"
                  onClick={handleAddTask}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="tp-button tp-button-inline w-auto px-4"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
