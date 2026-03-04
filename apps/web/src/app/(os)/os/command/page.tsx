"use client";

import * as React from "react";

import { ThreeMonthCalendar } from "../../../../components/calendar/ThreeMonthCalendar";
import { assertDateISO, todayISO } from "../../../../lib/date";
import {
  computeDayScore,
  getCompletionMap,
  getCompletionMapForRange,
  listAllTasks,
  toggleTaskCompletion,
  type UnifiedTask,
} from "../../../../lib/command_center";

const ENGINE_ORDER: UnifiedTask["engine"][] = ["body", "mind", "money", "general"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getRangeFromOffset(monthOffset: number) {
  const base = addMonths(startOfMonth(new Date()), monthOffset);
  const start = toDateKey(startOfMonth(addMonths(base, -1)));
  const end = toDateKey(endOfMonth(addMonths(base, 1)));
  return { start, end };
}

const ENGINE_LABELS: Record<UnifiedTask["engine"], string> = {
  body: "BODY",
  mind: "MIND",
  money: "MONEY",
  general: "GENERAL",
};

function engineLabel(engine: UnifiedTask["engine"]) {
  return ENGINE_LABELS[engine];
}

export default function CommandCenterPage() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const [selectedDateISO, setSelectedDateISO] = React.useState<string>(() => todayKey);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [tasks, setTasks] = React.useState<UnifiedTask[]>([]);
  const [completionSet, setCompletionSet] = React.useState<Set<string>>(new Set());
  const [scoreByDate, setScoreByDate] = React.useState<Record<string, number>>({});
  const [startDateISO, setStartDateISO] = React.useState<string>(todayKey);

  React.useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const allTasks = await listAllTasks();
      if (!mounted) return;
      setTasks(allTasks);
      if (allTasks.length === 0) {
        setStartDateISO(todayKey);
        return;
      }
      const earliest = allTasks.reduce((min, task) => Math.min(min, task.createdAt), allTasks[0].createdAt);
      const earliestKey = toDateKey(new Date(earliest));
      setStartDateISO(earliestKey);
    }
    hydrate();
    return () => {
      mounted = false;
    };
  }, [todayKey]);

  React.useEffect(() => {
    let mounted = true;
    async function loadCompletions() {
      const safeDate = assertDateISO(selectedDateISO);
      const set = await getCompletionMap(safeDate);
      if (mounted) setCompletionSet(set);
    }
    loadCompletions();
    return () => {
      mounted = false;
    };
  }, [selectedDateISO]);

  React.useEffect(() => {
    let mounted = true;
    async function loadScores() {
      const { start, end } = getRangeFromOffset(monthOffset);
      const completionMap = await getCompletionMapForRange(start, end);
      const map: Record<string, number> = {};

      const startDate = parseDateKey(start);
      const endDate = parseDateKey(end);
      const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

      for (let i = 0; i < totalDays; i += 1) {
        const dateKey = toDateKey(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
        const set = completionMap.get(dateKey) ?? new Set<string>();
        map[dateKey] = computeDayScore(tasks, set).percent;
      }
      if (mounted) setScoreByDate(map);
    }
    loadScores();
    return () => {
      mounted = false;
    };
  }, [monthOffset, tasks]);

  function handleDateSelect(nextISO: string) {
    try {
      setSelectedDateISO(assertDateISO(nextISO));
    } catch (err) {
      console.error(err);
      setSelectedDateISO(todayKey);
    }
  }

  const score = React.useMemo(() => computeDayScore(tasks, completionSet), [tasks, completionSet]);

  const mainTasks = React.useMemo(() => {
    return tasks
      .filter((task) => task.kind === "main")
      .map((task) => ({ ...task, completed: completionSet.has(task.id) }))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine);
      });
  }, [tasks, completionSet]);

  const secondaryTasks = React.useMemo(() => {
    return tasks
      .filter((task) => task.kind === "secondary")
      .map((task) => ({ ...task, completed: completionSet.has(task.id) }))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine);
      });
  }, [tasks, completionSet]);

  async function handleToggle(task: UnifiedTask & { completed: boolean }) {
    await toggleTaskCompletion(task.id, selectedDateISO, task.completed);
    const nextSet = await getCompletionMap(selectedDateISO);
    setCompletionSet(nextSet);
    const { start, end } = getRangeFromOffset(monthOffset);
    const completionMap = await getCompletionMapForRange(start, end);
    const map: Record<string, number> = {};
    const startDate = parseDateKey(start);
    const endDate = parseDateKey(end);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    for (let i = 0; i < totalDays; i += 1) {
      const dateKey = toDateKey(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
      const set = completionMap.get(dateKey) ?? new Set<string>();
      map[dateKey] = computeDayScore(tasks, set).percent;
    }
    setScoreByDate(map);
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">COMMAND CENTER</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">All engines. One view.</p>
        </header>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">{score.percent}%</p>
          <p className="mt-2 text-xs text-white/65">
            Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal}
          </p>
          <div className="tp-progress mt-3">
            <span style={{ width: `${score.percent}%` }} />
          </div>
        </section>
      </div>

      <div className="mt-4">
        <ThreeMonthCalendar
          selectedDateISO={selectedDateISO}
          onSelect={handleDateSelect}
          monthOffset={monthOffset}
          onMonthOffsetChange={setMonthOffset}
          scoreByDate={scoreByDate}
          startDateISO={startDateISO}
          todayISO={todayKey}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Main Tasks</p>
            <p className="tp-muted">{selectedDateISO}</p>
          </div>

          {mainTasks.length === 0 ? (
            <div className="body-empty mt-4">No main tasks yet.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {mainTasks.map((task) => (
                <div key={task.id} className="cc-task-row body-task-row">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggle(task)}
                      className="h-4 w-4 accent-white"
                    />
                    <span>{task.title}</span>
                  </label>
                  <div className="cc-task-meta">
                    <span className="body-badge">{engineLabel(task.engine)}</span>
                    <span className="tp-muted text-xs">2 pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Secondary Tasks</p>
            <p className="tp-muted">{selectedDateISO}</p>
          </div>

          {secondaryTasks.length === 0 ? (
            <div className="body-empty mt-4">No secondary tasks yet.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {secondaryTasks.map((task) => (
                <div key={task.id} className="cc-task-row body-task-row">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggle(task)}
                      className="h-4 w-4 accent-white"
                    />
                    <span>{task.title}</span>
                  </label>
                  <div className="cc-task-meta">
                    <span className="body-badge">{engineLabel(task.engine)}</span>
                    <span className="tp-muted text-xs">1 pt</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
