"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { LazyRechartsProvider, preloadRecharts } from "@/components/ui/LazyRecharts";

import {
  computeDailyScore,
  getAllTasksByEngine,
  getCompletionsByEngineForRange,
  listEngines,
  titanDailyScore,
  type EngineId,
  type EngineTask,
} from "../../../../lib/analytics";
import { todayISO } from "../../../../lib/date";

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
] as const;

const ENGINE_LABELS: Record<EngineId, string> = {
  body: "Body",
  mind: "Mind",
  money: "Money",
  general: "General",
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateISO: string, delta: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const next = new Date(year, month - 1, day + delta);
  return toDateKey(next);
}

function getDateRange(startISO: string, endISO: string) {
  const dates: string[] = [];
  let cursor = startISO;
  while (cursor < endISO) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function getWeekKey(dateISO: string) {
  const date = new Date(`${dateISO}T00:00:00`);
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const week1 = new Date(temp.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${temp.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function heatColor(score: number, isFuture: boolean) {
  if (isFuture) return "rgba(255,255,255,0.08)";
  if (score === 0) return "rgba(255,60,60,0.55)";
  if (score < 60) {
    const intensity = score / 60;
    return `rgba(255,200,0,${0.25 + intensity * 0.55})`;
  }
  const intensity = Math.min(1, (score - 60) / 40);
  return `rgba(70,255,140,${0.25 + intensity * 0.55})`;
}

export default function AnalyticsClient() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const [rangeDays, setRangeDays] = React.useState(30);

  const rangeStart = React.useMemo(() => addDays(todayKey, -(rangeDays - 1)), [todayKey, rangeDays]);
  const rangeEnd = React.useMemo(() => addDays(todayKey, 1), [todayKey]);
  const heatmapStart = React.useMemo(() => addDays(todayKey, -83), [todayKey]);
  const unionStart = rangeStart < heatmapStart ? rangeStart : heatmapStart;

  type AnalyticsSnapshot = {
    tasksByEngine: Record<EngineId, EngineTask[]>;
    scoresByDate: Record<string, number>;
    engineScoreByDate: Record<EngineId, Record<string, number>>;
    taskReliability: Array<{ title: string; engine: EngineId; percent: number }>;
  };

  const emptySnapshot: AnalyticsSnapshot = {
    tasksByEngine: { body: [], mind: [], money: [], general: [] },
    scoresByDate: {},
    engineScoreByDate: { body: {}, mind: {}, money: {}, general: {} },
    taskReliability: [],
  };

  const snapshot =
    useLiveQuery(async (): Promise<AnalyticsSnapshot> => {
      const [tasks, completions] = await Promise.all([
        getAllTasksByEngine(),
        getCompletionsByEngineForRange(unionStart, rangeEnd),
      ]);

      const dates = getDateRange(unionStart, rangeEnd);
      const engineScores: Record<EngineId, Record<string, number>> = {
        body: {},
        mind: {},
        money: {},
        general: {},
      };
      const allScores: Record<string, number> = {};

      const completionByEngineDate: Record<EngineId, Map<string, Set<string | number>>> = {
        body: new Map(),
        mind: new Map(),
        money: new Map(),
        general: new Map(),
      };

      listEngines().forEach((engine) => {
        completions[engine].forEach((entry) => {
          const set = completionByEngineDate[engine].get(entry.dateISO) ?? new Set();
          set.add(entry.taskId);
          completionByEngineDate[engine].set(entry.dateISO, set);
        });
      });

      dates.forEach((dateISO) => {
        const dailyScores: Record<EngineId, ReturnType<typeof computeDailyScore>> = {
          body: computeDailyScore(tasks.body, completionByEngineDate.body.get(dateISO) ?? new Set()),
          mind: computeDailyScore(tasks.mind, completionByEngineDate.mind.get(dateISO) ?? new Set()),
          money: computeDailyScore(tasks.money, completionByEngineDate.money.get(dateISO) ?? new Set()),
          general: computeDailyScore(tasks.general, completionByEngineDate.general.get(dateISO) ?? new Set()),
        };
        listEngines().forEach((engine) => {
          engineScores[engine][dateISO] = dailyScores[engine].percent;
        });
        allScores[dateISO] = titanDailyScore(dailyScores);
      });

      const reliability: Array<{ title: string; engine: EngineId; percent: number }> = [];
      listEngines().forEach((engine) => {
        tasks[engine].forEach((task) => {
          const taskStart = toDateKey(new Date(task.createdAt));
          const effectiveStart = taskStart > rangeStart ? taskStart : rangeStart;
          const daysInRange = getDateRange(effectiveStart, rangeEnd).length;
          if (daysInRange === 0) return;

          const completionsForTask = completions[engine].filter((c) => c.taskId === task.id);
          const completedDates = new Set(completionsForTask.map((c) => c.dateISO));
          const completedCount = Array.from(completedDates).filter((d) => d >= effectiveStart && d < rangeEnd).length;
          const percent = Math.round((completedCount / daysInRange) * 100);
          reliability.push({ title: task.title, engine, percent });
        });
      });
      reliability.sort((a, b) => b.percent - a.percent);

      return { tasksByEngine: tasks, scoresByDate: allScores, engineScoreByDate: engineScores, taskReliability: reliability };
    }, [unionStart, rangeEnd, rangeStart, rangeDays]) ?? emptySnapshot;

  const { scoresByDate, engineScoreByDate, taskReliability } = snapshot;

  const rangeDates = React.useMemo(() => getDateRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const trendData = React.useMemo(
    () =>
      rangeDates.map((dateISO) => ({
        date: dateISO.slice(5),
        score: scoresByDate[dateISO] ?? 0,
      })),
    [rangeDates, scoresByDate],
  );

  const enginePerformance = React.useMemo(() => {
    return listEngines().map((engine) => {
      const scores = rangeDates.map((dateISO) => engineScoreByDate[engine][dateISO] ?? 0);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { engine: ENGINE_LABELS[engine], score: avg };
    });
  }, [engineScoreByDate, rangeDates]);

  const weeklyData = React.useMemo(() => {
    const buckets = new Map<string, { total: number; count: number }>();
    rangeDates.forEach((dateISO) => {
      const key = getWeekKey(dateISO);
      const score = scoresByDate[dateISO] ?? 0;
      const entry = buckets.get(key) ?? { total: 0, count: 0 };
      entry.total += score;
      entry.count += 1;
      buckets.set(key, entry);
    });
    return Array.from(buckets.entries()).map(([week, data]) => ({
      week,
      avg: data.count ? Math.round(data.total / data.count) : 0,
    }));
  }, [rangeDates, scoresByDate]);

  const heatmapDates = React.useMemo(() => getDateRange(heatmapStart, rangeEnd), [heatmapStart, rangeEnd]);

  const streakStats = React.useMemo(() => {
    let current = 0;
    for (let i = rangeDates.length - 1; i >= 0; i -= 1) {
      const score = scoresByDate[rangeDates[i]] ?? 0;
      if (score >= 60) current += 1;
      else break;
    }

    let longest = 0;
    let running = 0;
    rangeDates.forEach((dateISO) => {
      const score = scoresByDate[dateISO] ?? 0;
      if (score >= 60) {
        running += 1;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
    });

    const last30 = getDateRange(addDays(todayKey, -29), rangeEnd);
    const last30Avg = last30.length
      ? Math.round(last30.reduce((acc, dateISO) => acc + (scoresByDate[dateISO] ?? 0), 0) / last30.length)
      : 0;

    const bestWeekAvg = weeklyData.length
      ? Math.max(...weeklyData.map((w) => w.avg))
      : 0;

    return { current, longest, last30Avg, bestWeekAvg };
  }, [rangeDates, rangeEnd, scoresByDate, todayKey, weeklyData]);

  const { topReliable, bottomReliable } = React.useMemo(() => {
    const byName = [...taskReliability].sort((a, b) => {
      if (a.percent !== b.percent) return b.percent - a.percent;
      return a.title.localeCompare(b.title);
    });
    const top = byName.slice(0, 5);
    const topKeys = new Set(top.map((task) => `${task.engine}::${task.title}`));
    const byLeast = [...taskReliability].sort((a, b) => {
      if (a.percent !== b.percent) return a.percent - b.percent;
      return a.title.localeCompare(b.title);
    });
    const bottom = byLeast.filter((task) => !topKeys.has(`${task.engine}::${task.title}`)).slice(0, 5);
    return { topReliable: top, bottomReliable: bottom };
  }, [taskReliability]);

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">ANALYTICS</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Precision insights derived from your personal data.</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setRangeDays(option.days)}
              className={`tp-button tp-button-inline ${rangeDays === option.days ? "is-active" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Titan Score Trend</p>
          <div className="mt-4 h-56 min-h-[224px] w-full min-w-0">
            <LazyRechartsProvider fallback={<div className="h-full w-full rounded-md border border-white/5 bg-white/[0.02]" />}>
              {(rc) => (
                <rc.ResponsiveContainer width="100%" height="100%">
                  <rc.LineChart data={trendData}>
                    <rc.CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <rc.XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <rc.YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <rc.Tooltip contentStyle={{ background: "#0b0b0d", border: "1px solid rgba(255,255,255,0.08)" }} />
                    <rc.Line type="monotone" dataKey="score" stroke="#e6e6e6" strokeWidth={2} dot={false} />
                  </rc.LineChart>
                </rc.ResponsiveContainer>
              )}
            </LazyRechartsProvider>
          </div>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Engine Performance</p>
          <div className="mt-4 h-56 min-h-[224px] w-full min-w-0">
            <LazyRechartsProvider fallback={<div className="h-full w-full rounded-md border border-white/5 bg-white/[0.02]" />}>
              {(rc) => (
                <rc.ResponsiveContainer width="100%" height="100%">
                  <rc.BarChart data={enginePerformance}>
                    <rc.CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <rc.XAxis dataKey="engine" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <rc.YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <rc.Tooltip contentStyle={{ background: "#0b0b0d", border: "1px solid rgba(255,255,255,0.08)" }} />
                    <rc.Bar dataKey="score" fill="#e6e6e6" radius={[4, 4, 0, 0]} />
                  </rc.BarChart>
                </rc.ResponsiveContainer>
              )}
            </LazyRechartsProvider>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Consistency Heatmap</p>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {heatmapDates.map((dateISO) => {
              const score = scoresByDate[dateISO] ?? 0;
              const isFuture = dateISO > todayKey;
              return (
                <div
                  key={dateISO}
                  title={`${dateISO} • ${score}%`}
                  className="h-4 w-4 rounded-[4px] border border-white/5"
                  style={{ background: heatColor(score, isFuture) }}
                />
              );
            })}
          </div>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Weekly Discipline</p>
          <div className="mt-4 h-56 min-h-[224px] w-full min-w-0">
            <LazyRechartsProvider fallback={<div className="h-full w-full rounded-md border border-white/5 bg-white/[0.02]" />}>
              {(rc) => (
                <rc.ResponsiveContainer width="100%" height="100%">
                  <rc.BarChart data={weeklyData}>
                    <rc.CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <rc.XAxis dataKey="week" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <rc.YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }} />
                    <rc.Tooltip contentStyle={{ background: "#0b0b0d", border: "1px solid rgba(255,255,255,0.08)" }} />
                    <rc.Bar dataKey="avg" fill="#e6e6e6" radius={[4, 4, 0, 0]} />
                  </rc.BarChart>
                </rc.ResponsiveContainer>
              )}
            </LazyRechartsProvider>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Task Reliability</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="tp-muted text-xs uppercase tracking-[0.24em]">Most Reliable</p>
              <div className="mt-3 space-y-2">
                {topReliable.length === 0 ? (
                  <div className="tp-muted text-xs">No data yet.</div>
                ) : (
                  topReliable.map((task) => (
                    <div
                      key={`top-${task.engine}-${task.title}`}
                      className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 text-sm"
                    >
                      <span className="truncate">{task.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="body-badge">{ENGINE_LABELS[task.engine].toUpperCase()}</span>
                        <span className="tp-muted text-xs tabular-nums">{task.percent}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="tp-muted text-xs uppercase tracking-[0.24em]">Least Reliable</p>
              <div className="mt-3 space-y-2">
                {bottomReliable.length === 0 ? (
                  <div className="tp-muted text-xs">No data yet.</div>
                ) : (
                  bottomReliable.map((task) => (
                    <div
                      key={`bottom-${task.engine}-${task.title}`}
                      className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 text-sm"
                    >
                      <span className="truncate">{task.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="body-badge">{ENGINE_LABELS[task.engine].toUpperCase()}</span>
                        <span className="tp-muted text-xs tabular-nums">{task.percent}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Streak Stats</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="tp-panel p-4">
              <p className="tp-muted text-xs uppercase tracking-[0.22em]">Current Streak</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold leading-none tabular-nums">{streakStats.current}</span>
                <span className="tp-muted text-xs">days</span>
              </div>
            </div>
            <div className="tp-panel p-4">
              <p className="tp-muted text-xs uppercase tracking-[0.22em]">Longest Streak</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold leading-none tabular-nums">{streakStats.longest}</span>
                <span className="tp-muted text-xs">days</span>
              </div>
            </div>
            <div className="tp-panel p-4">
              <p className="tp-muted text-xs uppercase tracking-[0.22em]">Best Week Avg</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold leading-none tabular-nums">{streakStats.bestWeekAvg}</span>
                <span className="tp-muted text-xs">%</span>
              </div>
            </div>
            <div className="tp-panel p-4">
              <p className="tp-muted text-xs uppercase tracking-[0.22em]">Last 30d Avg</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-semibold leading-none tabular-nums">{streakStats.last30Avg}</span>
                <span className="tp-muted text-xs">%</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
