"use client";

import * as React from "react";
import Link from "next/link";

import type { DailyLog, EngineTodayView } from "../../lib/api";
import type { EngineName, EngineTaskRecord } from "../../lib/db";
import {
  archiveTask,
  createTask,
  getCycleCompletionMap,
  getEngineTodayView,
  getOrCreateTodayLog,
  listTasks,
  toggleTaskForToday,
} from "../../lib/api";
import { playClick, playComplete } from "../../lib/sound";
import { AddTaskModal } from "./AddTaskModal";
import { AnalyticsGrid } from "./AnalyticsGrid";
import { HudButton } from "./HudButton";
import { HudCard } from "./HudCard";
import { HudPill } from "./HudPill";
import { HudSectionTitle } from "./HudSectionTitle";

const ENGINE_TITLES: Record<EngineName, string> = {
  body: "Body",
  mind: "Mind",
  money: "Money",
  general: "General",
};

const ENGINE_TOOL_LINK: Partial<Record<EngineName, { href: string; label: string }>> = {
  body: { href: "/os/body/nutrition", label: "Nutrition" },
  mind: { href: "/os/mind/focus", label: "Open Tool" },
  money: { href: "/os/money/skill", label: "Open Tool" },
};

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computePct(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

export function TodayTasks({ engine }: { engine: EngineName }) {
  const [loading, setLoading] = React.useState(true);
  const [busyTaskId, setBusyTaskId] = React.useState<number | null>(null);
  const [taskActionId, setTaskActionId] = React.useState<number | null>(null);
  const [savingTask, setSavingTask] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [todayLog, setTodayLog] = React.useState<DailyLog | null>(null);
  const [view, setView] = React.useState<EngineTodayView | null>(null);
  const [completionMap, setCompletionMap] = React.useState<
    Record<string, { nonneg_done: number; nonneg_total: number; total_done: number; total_total: number }>
  >({});
  const [date, setDate] = React.useState(todayDateString());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextView = await getEngineTodayView(engine, date);
      const log = await getOrCreateTodayLog(nextView.engine.id as number, date);
      const tasks = await listTasks(nextView.engine.id as number);
      const cycleMap =
        nextView.cycle_start_date && nextView.cycle_length > 0
          ? await getCycleCompletionMap(
              nextView.engine.id as number,
              nextView.cycle_start_date,
              nextView.cycle_length,
            )
          : {};
      setView({ ...nextView, tasks });
      setTodayLog(log);
      setCompletionMap(cycleMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [date, engine]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (engine !== "body") return;
    window.localStorage.setItem("tp_body_selected_date", date);
  }, [date, engine]);

  async function onToggle(taskId: number) {
    if (!view?.engine.id || !todayLog) return;
    setBusyTaskId(taskId);
    setError(null);
    setInfo(null);
    const current = new Set(todayLog.completed_task_ids ?? []);
    if (current.has(taskId)) current.delete(taskId);
    else current.add(taskId);

    const total = view.today.total_active_tasks;
    const completed = current.size;
    setTodayLog({ ...todayLog, completed_task_ids: Array.from(current) });
    setView({
      ...view,
      today: {
        ...view.today,
        completed_tasks_today: completed,
        today_pct: computePct(completed, total),
      },
    });

    try {
      const nextStats = await toggleTaskForToday(view.engine.id as number, date, taskId);
      setView((prev) =>
        prev
          ? {
              ...prev,
              today: nextStats,
            }
          : prev,
      );
      if (nextStats.completed_tasks_today > (view.today.completed_tasks_today ?? 0)) {
        playComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await load();
    } finally {
      setBusyTaskId(null);
    }
  }

  const tasks = React.useMemo(() => {
    if (!view) return [];
    return [...view.tasks].sort((a, b) => {
      if (a.is_non_negotiable !== b.is_non_negotiable) {
        return a.is_non_negotiable ? -1 : 1;
      }
      return (a.created_at ?? 0) - (b.created_at ?? 0);
    });
  }, [view]);

  const completedIds = new Set(todayLog?.completed_task_ids ?? []);
  const nonNegotiables = tasks.filter((task) => task.is_non_negotiable);
  const normalTasks = tasks.filter((task) => !task.is_non_negotiable);
  const title = ENGINE_TITLES[engine];
  const tool = ENGINE_TOOL_LINK[engine];

  async function onAddTask(payload: { title: string; is_non_negotiable: boolean }) {
    if (!view?.engine.id) return;
    setSavingTask(true);
    setError(null);
    try {
      await createTask({
        engine_id: view.engine.id as number,
        title: payload.title,
        is_non_negotiable: payload.is_non_negotiable,
      });
      setShowAddModal(false);
      await load();
      setInfo("Task added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingTask(false);
    }
  }

  async function onArchiveTask(task: EngineTaskRecord) {
    if (!task.id) return;
    setSavingTask(true);
    setTaskActionId(null);
    setError(null);
    try {
      await archiveTask(task.id);
      await load();
      setInfo("Task archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">{title} Today</h1>
          <p className="mt-2 text-sm text-white/70">
            Today • Timeframe Day {view?.cycle_day ?? 0}/{view?.cycle_length ?? 0} •{" "}
            {(view?.today.today_pct ?? 0).toFixed(0)}%
          </p>
          <p className="mt-1 text-xs text-white/55">Timeframe = your active cycle window for this Plan.</p>
        </div>
        {tool ? (
          <Link
            href={tool.href}
            onClick={playClick}
            className="chrome-btn inline-flex items-center justify-center px-3 py-2 text-sm text-white"
          >
            {tool.label}
          </Link>
        ) : null}
      </header>

      {loading ? <p className="text-white/80">Loading today...</p> : null}

      {!loading && error ? (
        <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {!loading && !error && view ? (
        <section className="space-y-4">
          {view.cycle_start_date && view.cycle_length > 0 ? (
            <AnalyticsGrid
              startDate={view.cycle_start_date}
              totalDays={view.cycle_length}
              selectedDate={date}
              today={todayDateString()}
              getDayScore={(day) => {
                const score = completionMap[day] ?? {
                  nonneg_done: 0,
                  nonneg_total: 0,
                  total_done: 0,
                  total_total: 0,
                };
                return {
                  nonNegotiablesDone: score.nonneg_done,
                  nonNegotiablesTotal: score.nonneg_total,
                  optionalDone: Math.max(0, score.total_done - score.nonneg_done),
                  optionalTotal: Math.max(0, score.total_total - score.nonneg_total),
                  isFuture: day > todayDateString(),
                };
              }}
              onSelectDate={setDate}
            />
          ) : null}

          {view.cycle_length === 0 ? (
            <HudCard>
              {engine === "body" ? (
                <>
                  <p className="text-sm text-white/80">
                    No active Body cycle. Create one to start your non-negotiables and daily tasks.
                  </p>
                  <Link
                    href="/os/body/intake?timeframe=90"
                    onClick={playClick}
                    className="hud-btn mt-4 inline-flex px-4 py-2 text-sm text-white"
                  >
                    Create Body Cycle
                  </Link>
                </>
              ) : (
                <p className="text-sm text-white/80">No active cycle for this engine yet.</p>
              )}
            </HudCard>
          ) : null}

          <HudCard
            title="Today Completion"
            rightSlot={<HudPill>{date}</HudPill>}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <HudSectionTitle>Tasks Done</HudSectionTitle>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {view.today.completed_tasks_today}/{view.today.total_active_tasks} ({view.today.today_pct.toFixed(0)}%)
                </p>
              </div>
              <div className="text-left sm:text-right">
                <HudSectionTitle>Timeframe Consistency</HudSectionTitle>
                <p className="mt-1 text-2xl font-semibold text-white">{view.cycle_consistency_pct.toFixed(0)}%</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/70 transition-all duration-200"
                style={{ width: `${view.today.today_pct}%` }}
              />
            </div>
          </HudCard>

          <HudCard
            title="Tasks"
            rightSlot={
              <div className="flex items-center gap-2">
                <HudPill>{date}</HudPill>
                <HudButton className="px-2 py-1 text-xs text-white" onClick={() => setShowAddModal(true)}>
                  Add Task
                </HudButton>
              </div>
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <HudSectionTitle>Equal-weight scoring: completed / total</HudSectionTitle>
            </div>

            {nonNegotiables.length > 0 ? (
              <div className="mb-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.12em] text-white/55">Non-Negotiables</p>
                {nonNegotiables.map((task) => (
                  <div
                    key={task.id}
                    className="chrome-outline flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={completedIds.has(task.id as number)}
                        onChange={() => void onToggle(task.id as number)}
                        disabled={busyTaskId === task.id}
                      />
                      <span>{task.title}</span>
                    </label>
                    {!task.is_locked ? (
                      <div className="relative">
                        <button
                          type="button"
                          className="hud-btn px-2 py-1 text-xs text-white"
                          onClick={() =>
                            setTaskActionId((prev) => (prev === task.id ? null : (task.id as number)))
                          }
                        >
                          ...
                        </button>
                        {taskActionId === task.id ? (
                          <div className="hud-card absolute right-0 top-9 z-20 min-w-[120px] p-2">
                            <button
                              type="button"
                              className="w-full rounded px-2 py-1 text-left text-xs text-white/85 hover:bg-white/10"
                              onClick={() => void onArchiveTask(task)}
                            >
                              Archive task
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[10px] uppercase tracking-[0.14em] text-white/50">Locked</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.12em] text-white/55">Tasks</p>
              {normalTasks.length > 0 ? (
                normalTasks.map((task) => (
                  <div
                    key={task.id}
                    className="chrome-outline flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-white">
                      <input
                        type="checkbox"
                        checked={completedIds.has(task.id as number)}
                        onChange={() => void onToggle(task.id as number)}
                        disabled={busyTaskId === task.id}
                      />
                      <span>{task.title}</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        className="hud-btn px-2 py-1 text-xs text-white"
                        onClick={() =>
                          setTaskActionId((prev) => (prev === task.id ? null : (task.id as number)))
                        }
                      >
                        ...
                      </button>
                      {taskActionId === task.id ? (
                        <div className="hud-card absolute right-0 top-9 z-20 min-w-[120px] p-2">
                          <button
                            type="button"
                            className="w-full rounded px-2 py-1 text-left text-xs text-white/85 hover:bg-white/10"
                            onClick={() => void onArchiveTask(task)}
                          >
                            Archive task
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">No active tasks.</p>
              )}
            </div>
            {info ? <p className="mt-3 text-xs text-white/60">{info}</p> : null}
          </HudCard>
        </section>
      ) : null}

      <AddTaskModal
        open={showAddModal}
        saving={savingTask}
        onClose={() => setShowAddModal(false)}
        onSubmit={onAddTask}
      />
    </main>
  );
}
