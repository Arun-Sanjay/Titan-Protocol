/**
 * Dashboard statistics helpers for Titan Protocol.
 *
 * These functions aggregate scoring data across multiple days for use in
 * the dashboard's weekly summaries, sparklines, and comparison panels.
 *
 * These functions consume scoring.ts range APIs, which directly access Dexie
 * tables and participate in liveQuery reactivity.
 */

import {
  ENGINES,
  computeTitanPercent,
  getDateRangeScoresForAllEngines,
  getDateRangeScoresForEngine,
  getDayScoresForDate,
  type DayScore,
  type EngineKey,
  type TitanScore,
} from "./scoring";
import { addDaysISO, todayISO } from "./date";
import { getCompletionMap, listAllTasks, type UnifiedTask } from "./command_center";

// ---------------------------------------------------------------------------
// getWeekScores
// ---------------------------------------------------------------------------

export type WeekScoreEntry = { dateKey: string; percent: number };

/**
 * Returns an array of 7 entries (today + 6 days before) with the day score
 * percentage for the given engine, ordered oldest-first.
 */
export async function getWeekScores(
  engineKey: EngineKey,
): Promise<WeekScoreEntry[]> {
  const end = todayISO();
  const start = addDaysISO(end, -6);
  const range = await getDateRangeScoresForEngine(engineKey, start, end);
  return range.map((entry) => ({ dateKey: entry.dateKey, percent: entry.score.percent }));
}

// ---------------------------------------------------------------------------
// getWeekComparison
// ---------------------------------------------------------------------------

export type WeekComparisonEntry = {
  engine: EngineKey;
  thisWeekAvg: number;
  lastWeekAvg: number;
  change: number;
};

/**
 * For each of the 4 engines, computes the average day-score for "this week"
 * (last 7 days, inclusive of today) and "last week" (days 7-13 ago), then
 * returns the percentage-point change (thisWeekAvg - lastWeekAvg).
 */
export async function getWeekComparison(): Promise<WeekComparisonEntry[]> {
  const end = todayISO();
  const start = addDaysISO(end, -13);
  const all = await getDateRangeScoresForAllEngines(start, end);

  return ENGINES.map((engine) => {
    const scores = all[engine].map((entry) => entry.score.percent);
    const lastWeek = scores.slice(0, 7);
    const thisWeek = scores.slice(7, 14);
    const lastWeekAvg = lastWeek.length === 0 ? 0 : Math.round(lastWeek.reduce((sum, value) => sum + value, 0) / 7);
    const thisWeekAvg = thisWeek.length === 0 ? 0 : Math.round(thisWeek.reduce((sum, value) => sum + value, 0) / 7);
    return {
      engine,
      thisWeekAvg,
      lastWeekAvg,
      change: thisWeekAvg - lastWeekAvg,
    };
  });
}

// ---------------------------------------------------------------------------
// getWeekTaskStats
// ---------------------------------------------------------------------------

export type WeekTaskStats = {
  totalCompleted: number;
  bestDay: { dateKey: string; percent: number };
};

const ENGINE_META: Record<EngineKey, { label: string; route: string }> = {
  body: { label: "Body", route: "/os/body" },
  mind: { label: "Mind", route: "/os/mind" },
  money: { label: "Money", route: "/os/money" },
  general: { label: "General", route: "/os/general" },
};

const QUICK_ACTIONS: DailyQuickAction[] = [
  { label: "Capture Task", href: "/os/command", description: "Open command center" },
  { label: "Start Focus", href: "/os/focus", description: "Launch a focus block" },
  { label: "Review Goals", href: "/os/goals", description: "Check daily targets" },
  { label: "Log Journal", href: "/os/journal", description: "Record a reflection" },
];

export type DailyRiskEngine = {
  engine: EngineKey;
  label: string;
  route: string;
  scorePct: number;
  isActive: boolean;
  reason: string;
};

export type DailyPlanningTask = {
  id: string;
  title: string;
  engine: EngineKey;
  engineLabel: string;
  route: string;
  createdAt: number;
};

export type DailyQuickAction = {
  label: string;
  href: string;
  description: string;
};

export type DailyNextAction = {
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export type DailyPlanningModel = {
  dateKey: string;
  titan: TitanScore;
  summary: {
    completedPoints: number;
    totalPoints: number;
    incompleteMainCount: number;
  };
  enginesAtRisk: DailyRiskEngine[];
  topIncompleteMainTasks: DailyPlanningTask[];
  nextBestAction: DailyNextAction;
  quickActions: DailyQuickAction[];
};

function toTitanScore(perEngine: Record<EngineKey, DayScore>): TitanScore {
  const enginesActiveCount = ENGINES.filter((engine) => perEngine[engine].pointsTotal > 0).length;
  return {
    perEngine,
    enginesActiveCount,
    percent: computeTitanPercent(ENGINES.map((engine) => perEngine[engine])),
  };
}

function deriveEnginesAtRisk(titan: TitanScore): DailyRiskEngine[] {
  return ENGINES
    .map((engine) => {
      const score = titan.perEngine[engine];
      const isActive = score.pointsTotal > 0;
      if (isActive && score.percent >= 60) return null;
      return {
        engine,
        label: ENGINE_META[engine].label,
        route: ENGINE_META[engine].route,
        scorePct: score.percent,
        isActive,
        reason: isActive ? `Below threshold at ${score.percent}%` : "No active score yet",
      };
    })
    .filter((entry): entry is DailyRiskEngine => entry !== null)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? 1 : -1;
      return a.scorePct - b.scorePct;
    });
}

function toPlanningTask(task: UnifiedTask): DailyPlanningTask {
  return {
    id: task.id,
    title: task.title,
    engine: task.engine,
    engineLabel: ENGINE_META[task.engine].label,
    route: ENGINE_META[task.engine].route,
    createdAt: task.createdAt,
  };
}

function deriveNextBestAction(
  dateKey: string,
  riskEngines: DailyRiskEngine[],
  topIncompleteMainTasks: DailyPlanningTask[],
): DailyNextAction {
  const firstTask = topIncompleteMainTasks[0];
  if (firstTask) {
    return {
      title: `Execute ${firstTask.engineLabel} main task`,
      detail: firstTask.title,
      href: firstTask.route,
      cta: "Open engine",
    };
  }

  const firstRisk = riskEngines[0];
  if (firstRisk) {
    return {
      title: `${firstRisk.label} needs attention`,
      detail: `${firstRisk.reason} (${dateKey})`,
      href: firstRisk.route,
      cta: "Resolve risk",
    };
  }

  return {
    title: "Lock momentum with a focus block",
    detail: "No urgent risks detected. Convert the day into deep output.",
    href: "/os/focus",
    cta: "Start focus",
  };
}

export async function getDailyPlanningModel(dateKey: string): Promise<DailyPlanningModel> {
  const safeDate = dateKey || todayISO();
  const [perEngine, allTasks, completionMap] = await Promise.all([
    getDayScoresForDate(safeDate),
    listAllTasks(),
    getCompletionMap(safeDate),
  ]);

  const titan = toTitanScore(perEngine);
  const enginesAtRisk = deriveEnginesAtRisk(titan);
  const riskOrder = new Map<EngineKey, number>(enginesAtRisk.map((entry, index) => [entry.engine, index]));

  const incompleteMain = allTasks
    .filter((task) => task.kind === "main" && !completionMap.has(task.id))
    .sort((a, b) => {
      const aRisk = riskOrder.get(a.engine) ?? Number.MAX_SAFE_INTEGER;
      const bRisk = riskOrder.get(b.engine) ?? Number.MAX_SAFE_INTEGER;
      if (aRisk !== bRisk) return aRisk - bRisk;
      return a.createdAt - b.createdAt;
    });

  const topIncompleteMainTasks = incompleteMain.slice(0, 6).map(toPlanningTask);
  const completedPoints = ENGINES.reduce((sum, engine) => sum + titan.perEngine[engine].pointsDone, 0);
  const totalPoints = ENGINES.reduce((sum, engine) => sum + titan.perEngine[engine].pointsTotal, 0);

  return {
    dateKey: safeDate,
    titan,
    summary: {
      completedPoints,
      totalPoints,
      incompleteMainCount: incompleteMain.length,
    },
    enginesAtRisk,
    topIncompleteMainTasks,
    nextBestAction: deriveNextBestAction(safeDate, enginesAtRisk, topIncompleteMainTasks),
    quickActions: QUICK_ACTIONS,
  };
}

/**
 * Scans the last 7 days across all 4 engines and returns:
 * - totalCompleted: sum of mainDone + secondaryDone across all engines/days
 * - bestDay: the single day with the highest average percent across engines
 */
export async function getWeekTaskStats(): Promise<WeekTaskStats> {
  const end = todayISO();
  const start = addDaysISO(end, -6);
  const all = await getDateRangeScoresForAllEngines(start, end);

  const dateKeys = all.body.map((entry) => entry.dateKey);
  let totalCompleted = 0;
  let bestDay: { dateKey: string; percent: number } = {
    dateKey: end,
    percent: 0,
  };

  for (let i = 0; i < dateKeys.length; i++) {
    const dateKey = dateKeys[i];
    let dayPercentSum = 0;
    let activeEngines = 0;

    for (const engine of ENGINES) {
      const score = all[engine][i]?.score;
      if (!score) continue;
      totalCompleted += score.mainDone + score.secondaryDone;

      if (score.pointsTotal > 0) {
        dayPercentSum += score.percent;
        activeEngines++;
      }
    }

    const dayAvg =
      activeEngines > 0 ? Math.round(dayPercentSum / activeEngines) : 0;

    if (dayAvg > bestDay.percent) {
      bestDay = { dateKey, percent: dayAvg };
    }
  }

  return { totalCompleted, bestDay };
}
