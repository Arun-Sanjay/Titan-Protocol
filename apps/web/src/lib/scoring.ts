/**
 * Centralized scoring module for Titan Protocol.
 *
 * This file is the canonical source of truth for all score computation:
 * - main task = 2 points
 * - secondary task = 1 point
 * - engine score = completed points / total points
 * - Titan score = average of active engine scores
 */

import {
  db,
  type BodyLog,
  type BodyTask,
  type GeneralLog,
  type GeneralTask,
  type MindTask,
  type MindTaskCompletion,
  type MoneyLog,
  type MoneyTask,
} from "./db";
import {
  addDaysISO,
  assertDateISO,
  listDateRangeISO,
  monthBounds,
  todayISO,
  weekStartISO,
} from "./date";

export type EngineKey = "body" | "mind" | "money" | "general";

export type DayScore = {
  percent: number;
  mainDone: number;
  mainTotal: number;
  secondaryDone: number;
  secondaryTotal: number;
  pointsDone: number;
  pointsTotal: number;
};

export type DateScoreEntry = {
  dateKey: string;
  score: DayScore;
};

export type EngineRangeScores = DateScoreEntry[];

export type AllEnginesRangeScores = Record<EngineKey, EngineRangeScores>;

export type ConsistencyResult = {
  percent: number;
  consistentDays: number;
  totalDays: number;
  currentStreak: number;
  bestStreak: number;
};

export type TitanScore = {
  percent: number;
  perEngine: Record<EngineKey, DayScore>;
  enginesActiveCount: number;
};

export const ENGINES: EngineKey[] = ["body", "mind", "money", "general"];

export const EMPTY_SCORE: DayScore = {
  percent: 0,
  mainDone: 0,
  mainTotal: 0,
  secondaryDone: 0,
  secondaryTotal: 0,
  pointsDone: 0,
  pointsTotal: 0,
};

const EMPTY_NUMBER_SET = new Set<number>();
const EMPTY_STRING_SET = new Set<string>();

type BodyLikeEngine = "body" | "money" | "general";

type BodyLikeTaskRow = {
  id: number;
  priority: "main" | "secondary";
  daysPerWeek?: number;
};

type BodyLikeLogRow = {
  dateKey: string;
  completedTaskIds: number[];
};

type MindTaskRow = {
  id: string;
  kind: "main" | "secondary";
  isActive: boolean;
  daysPerWeek?: number;
};

type MindCompletionRow = {
  dateKey: string;
  taskId: string;
  completed: boolean;
};

type BodyLikeSnapshot = {
  tasks: BodyLikeTaskRow[];
  logs: BodyLikeLogRow[];
  completedByDate: Map<string, Set<number>>;
};

type MindSnapshot = {
  tasks: MindTaskRow[];
  completions: MindCompletionRow[];
  completedByDate: Map<string, Set<string>>;
};

export function computeDayScoreFromCounts(
  mainTotal: number,
  mainDone: number,
  secondaryTotal: number,
  secondaryDone: number,
): DayScore {
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);
  return { percent, mainDone, mainTotal, secondaryDone, secondaryTotal, pointsDone, pointsTotal };
}

export function computeTitanPercent(scores: ReadonlyArray<Pick<DayScore, "percent" | "pointsTotal">>): number {
  const active = scores.filter((score) => score.pointsTotal > 0);
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, score) => acc + score.percent, 0);
  return Math.round(sum / active.length);
}

function emptyAllEngineScores(): AllEnginesRangeScores {
  return {
    body: [],
    mind: [],
    money: [],
    general: [],
  };
}

function normalizeBodyLikeTasks(tasks: Array<BodyTask | MoneyTask | GeneralTask>): BodyLikeTaskRow[] {
  return tasks.map((task) => ({ id: task.id ?? -1, priority: task.priority, daysPerWeek: task.daysPerWeek }));
}

function normalizeBodyLikeLogs(logs: Array<BodyLog | MoneyLog | GeneralLog>): BodyLikeLogRow[] {
  return logs
    .filter((log) => typeof log.dateKey === "string")
    .map((log) => ({ dateKey: log.dateKey, completedTaskIds: log.completedTaskIds ?? [] }));
}

function normalizeMindTasks(tasks: MindTask[]): MindTaskRow[] {
  return tasks.map((task) => ({
    id: task.id,
    kind: task.kind,
    isActive: task.isActive !== false,
    daysPerWeek: task.daysPerWeek,
  }));
}

function normalizeMindCompletions(completions: MindTaskCompletion[]): MindCompletionRow[] {
  return completions
    .filter((entry) => typeof entry.dateKey === "string")
    .map((entry) => ({ dateKey: entry.dateKey, taskId: entry.taskId, completed: entry.completed }));
}

function countBodyLikeWeeklyCompletions(
  taskId: number,
  weekStart: string,
  dateKey: string,
  logs: BodyLikeLogRow[],
): number {
  let count = 0;
  for (const log of logs) {
    if (log.dateKey < weekStart || log.dateKey >= dateKey) continue;
    if (log.completedTaskIds.includes(taskId)) count++;
  }
  return count;
}

function countMindWeeklyCompletions(
  taskId: string,
  weekStart: string,
  dateKey: string,
  completions: MindCompletionRow[],
): number {
  let count = 0;
  for (const entry of completions) {
    if (!entry.completed) continue;
    if (entry.taskId !== taskId) continue;
    if (entry.dateKey < weekStart || entry.dateKey >= dateKey) continue;
    count++;
  }
  return count;
}

async function loadBodyLikeSnapshot(
  engine: BodyLikeEngine,
  historyStart: string,
  historyEnd: string,
): Promise<BodyLikeSnapshot> {
  const [rawTasks, rawLogs] = await (engine === "body"
    ? Promise.all([
        db.body_tasks.toArray() as Promise<Array<BodyTask | MoneyTask | GeneralTask>>,
        db.body_logs.where("dateKey").between(historyStart, historyEnd, true, true).toArray() as Promise<
          Array<BodyLog | MoneyLog | GeneralLog>
        >,
      ])
    : engine === "money"
      ? Promise.all([
          db.money_tasks.toArray() as Promise<Array<BodyTask | MoneyTask | GeneralTask>>,
          db.money_logs.where("dateKey").between(historyStart, historyEnd, true, true).toArray() as Promise<
            Array<BodyLog | MoneyLog | GeneralLog>
          >,
        ])
      : Promise.all([
          db.general_tasks.toArray() as Promise<Array<BodyTask | MoneyTask | GeneralTask>>,
          db.general_logs.where("dateKey").between(historyStart, historyEnd, true, true).toArray() as Promise<
            Array<BodyLog | MoneyLog | GeneralLog>
          >,
        ]));

  const tasks = normalizeBodyLikeTasks(rawTasks);
  const logs = normalizeBodyLikeLogs(rawLogs);
  const completedByDate = new Map<string, Set<number>>();

  for (const log of logs) {
    completedByDate.set(log.dateKey, new Set(log.completedTaskIds));
  }

  return { tasks, logs, completedByDate };
}

async function loadMindSnapshot(historyStart: string, historyEnd: string): Promise<MindSnapshot> {
  const [rawTasks, rawCompletions] = await Promise.all([
    db.mind_tasks.toArray(),
    db.mind_task_completions.where("dateKey").between(historyStart, historyEnd, true, true).toArray(),
  ]);

  const tasks = normalizeMindTasks(rawTasks);
  const completions = normalizeMindCompletions(rawCompletions);
  const completedByDate = new Map<string, Set<string>>();

  for (const entry of completions) {
    if (!entry.completed) continue;
    const set = completedByDate.get(entry.dateKey) ?? new Set<string>();
    set.add(entry.taskId);
    completedByDate.set(entry.dateKey, set);
  }

  return { tasks, completions, completedByDate };
}

function computeBodyLikeScoreForDate(snapshot: BodyLikeSnapshot, dateKey: string): DayScore {
  const weekStart = weekStartISO(dateKey);
  const done = snapshot.completedByDate.get(dateKey) ?? EMPTY_NUMBER_SET;

  let mainTotal = 0;
  let mainDone = 0;
  let secondaryTotal = 0;
  let secondaryDone = 0;

  for (const task of snapshot.tasks) {
    const daysPerWeek = task.daysPerWeek ?? 7;
    if (daysPerWeek < 7) {
      const completions = countBodyLikeWeeklyCompletions(task.id, weekStart, dateKey, snapshot.logs);
      if (completions >= daysPerWeek) continue;
    }

    if (task.priority === "main") {
      mainTotal++;
      if (done.has(task.id)) mainDone++;
    } else {
      secondaryTotal++;
      if (done.has(task.id)) secondaryDone++;
    }
  }

  return computeDayScoreFromCounts(mainTotal, mainDone, secondaryTotal, secondaryDone);
}

function computeMindScoreForDate(snapshot: MindSnapshot, dateKey: string): DayScore {
  const weekStart = weekStartISO(dateKey);
  const done = snapshot.completedByDate.get(dateKey) ?? EMPTY_STRING_SET;

  let mainTotal = 0;
  let mainDone = 0;
  let secondaryTotal = 0;
  let secondaryDone = 0;

  for (const task of snapshot.tasks) {
    if (!task.isActive) continue;

    const daysPerWeek = task.daysPerWeek ?? 7;
    if (daysPerWeek < 7) {
      const weekCount = countMindWeeklyCompletions(task.id, weekStart, dateKey, snapshot.completions);
      if (weekCount >= daysPerWeek) continue;
    }

    if (task.kind === "main") {
      mainTotal++;
      if (done.has(task.id)) mainDone++;
    } else {
      secondaryTotal++;
      if (done.has(task.id)) secondaryDone++;
    }
  }

  return computeDayScoreFromCounts(mainTotal, mainDone, secondaryTotal, secondaryDone);
}

export async function getDateRangeScoresForEngine(
  engine: EngineKey,
  startDate: string,
  endDate: string,
): Promise<EngineRangeScores> {
  const safeStart = assertDateISO(startDate);
  const safeEnd = assertDateISO(endDate);
  if (safeStart > safeEnd) return [];

  const historyStart = weekStartISO(safeStart);
  const dateKeys = listDateRangeISO(safeStart, safeEnd);

  if (engine === "mind") {
    const snapshot = await loadMindSnapshot(historyStart, safeEnd);
    return dateKeys.map((dateKey) => ({ dateKey, score: computeMindScoreForDate(snapshot, dateKey) }));
  }

  const snapshot = await loadBodyLikeSnapshot(engine, historyStart, safeEnd);
  return dateKeys.map((dateKey) => ({ dateKey, score: computeBodyLikeScoreForDate(snapshot, dateKey) }));
}

export async function getDateRangeScoresForAllEngines(
  startDate: string,
  endDate: string,
): Promise<AllEnginesRangeScores> {
  const safeStart = assertDateISO(startDate);
  const safeEnd = assertDateISO(endDate);
  if (safeStart > safeEnd) return emptyAllEngineScores();

  const historyStart = weekStartISO(safeStart);
  const dateKeys = listDateRangeISO(safeStart, safeEnd);

  const [bodySnapshot, mindSnapshot, moneySnapshot, generalSnapshot] = await Promise.all([
    loadBodyLikeSnapshot("body", historyStart, safeEnd),
    loadMindSnapshot(historyStart, safeEnd),
    loadBodyLikeSnapshot("money", historyStart, safeEnd),
    loadBodyLikeSnapshot("general", historyStart, safeEnd),
  ]);

  return {
    body: dateKeys.map((dateKey) => ({ dateKey, score: computeBodyLikeScoreForDate(bodySnapshot, dateKey) })),
    mind: dateKeys.map((dateKey) => ({ dateKey, score: computeMindScoreForDate(mindSnapshot, dateKey) })),
    money: dateKeys.map((dateKey) => ({ dateKey, score: computeBodyLikeScoreForDate(moneySnapshot, dateKey) })),
    general: dateKeys.map((dateKey) => ({ dateKey, score: computeBodyLikeScoreForDate(generalSnapshot, dateKey) })),
  };
}

export async function getDayScoreForEngine(engine: EngineKey, dateKey: string): Promise<DayScore> {
  const safeDate = assertDateISO(dateKey);
  const [entry] = await getDateRangeScoresForEngine(engine, safeDate, safeDate);
  return entry?.score ?? EMPTY_SCORE;
}

export async function getDayScoresForDate(dateKey: string): Promise<Record<EngineKey, DayScore>> {
  const safeDate = assertDateISO(dateKey);
  const all = await getDateRangeScoresForAllEngines(safeDate, safeDate);
  return {
    body: all.body[0]?.score ?? EMPTY_SCORE,
    mind: all.mind[0]?.score ?? EMPTY_SCORE,
    money: all.money[0]?.score ?? EMPTY_SCORE,
    general: all.general[0]?.score ?? EMPTY_SCORE,
  };
}

export async function getMonthConsistencyForEngine(
  engine: EngineKey,
  monthKey: string,
): Promise<ConsistencyResult> {
  const safe = assertDateISO(monthKey);
  const { start, end } = monthBounds(safe);
  const monthEndInclusive = addDaysISO(end, -1);

  const monthlyScores = await getDateRangeScoresForEngine(engine, start, monthEndInclusive);
  const scoreByDate = new Map<string, number>();
  for (const entry of monthlyScores) {
    if (entry.score.pointsTotal > 0) {
      scoreByDate.set(entry.dateKey, entry.score.percent);
    }
  }

  const now = todayISO();
  const effectiveEnd = now < end ? now : monthEndInclusive;
  if (start > effectiveEnd) {
    return { percent: 0, consistentDays: 0, totalDays: 0, currentStreak: 0, bestStreak: 0 };
  }

  const days = listDateRangeISO(start, effectiveEnd);
  let consistentDays = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (const day of days) {
    if ((scoreByDate.get(day) ?? 0) >= 60) {
      consistentDays++;
      runningStreak++;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if ((scoreByDate.get(days[i]) ?? 0) >= 60) {
      currentStreak++;
    } else {
      break;
    }
  }

  const totalDays = days.length;
  const percent = totalDays === 0 ? 0 : Math.round((consistentDays / totalDays) * 100);
  return { percent, consistentDays, totalDays, currentStreak, bestStreak };
}

export async function getTitanScoreForDate(dateKey: string): Promise<TitanScore> {
  const perEngine = await getDayScoresForDate(dateKey);
  const percent = computeTitanPercent(ENGINES.map((engine) => perEngine[engine]));
  const enginesActiveCount = ENGINES.filter((engine) => perEngine[engine].pointsTotal > 0).length;
  return { percent, perEngine, enginesActiveCount };
}

export type MonthConsistencyResult = {
  consistencyPct: number;
  consistentDays: number;
  daysElapsed: number;
  currentStreak: number;
  bestStreak: number;
};

/**
 * Pure computation of monthly consistency from a pre-built score map.
 * Shared across Body, Mind, Money, General, and Command Center pages.
 */
export function computeMonthConsistency(
  scoreMap: Record<string, number>,
  monthStartKey: string,
  monthEndKey: string,
  dataStartKey: string,
  referenceKey: string,
  threshold = 60,
): MonthConsistencyResult {
  const effectiveStart = dataStartKey && dataStartKey > monthStartKey ? dataStartKey : monthStartKey;
  const effectiveEnd = referenceKey < monthEndKey ? referenceKey : monthEndKey;

  if (!effectiveStart || effectiveStart > effectiveEnd) {
    return { consistencyPct: 0, consistentDays: 0, daysElapsed: 0, currentStreak: 0, bestStreak: 0 };
  }

  const days = listDateRangeISO(effectiveStart, effectiveEnd);
  let daysElapsed = 0;
  let consistentDays = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (const dateKey of days) {
    daysElapsed += 1;
    if ((scoreMap[dateKey] ?? 0) >= threshold) {
      consistentDays += 1;
      runningStreak += 1;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if ((scoreMap[days[i]!] ?? 0) >= threshold) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const consistencyPct = daysElapsed === 0 ? 0 : Math.round((consistentDays / daysElapsed) * 100);
  return { consistencyPct, consistentDays, daysElapsed, currentStreak, bestStreak };
}
