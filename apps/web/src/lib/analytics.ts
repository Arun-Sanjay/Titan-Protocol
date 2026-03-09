import { db, type BodyTask, type GeneralTask, type MindTask, type MoneyTask } from "./db";
import { assertDateISO, isDateInRangeISO } from "./date";
import { computeDayScoreFromCounts, computeTitanPercent, type DayScore } from "./scoring";

export type EngineId = "body" | "mind" | "money" | "general";

export type EngineTask = {
  id: string | number;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
};

export type EngineCompletion = {
  dateISO: string;
  taskId: string | number;
};

export type DailyScore = DayScore;

export function listEngines(): EngineId[] {
  return ["body", "mind", "money", "general"];
}

export async function getAllTasksByEngine(): Promise<Record<EngineId, EngineTask[]>> {
  const [bodyTasks, mindTasks, moneyTasks, generalTasks] = await Promise.all([
    db.body_tasks.toArray(),
    db.mind_tasks.toArray(),
    db.money_tasks.toArray(),
    db.general_tasks.toArray(),
  ]);

  return {
    body: (bodyTasks as BodyTask[]).map((task) => ({
      id: task.id ?? 0,
      title: task.title,
      kind: task.priority,
      createdAt: task.createdAt,
    })),
    mind: (mindTasks as MindTask[])
      .filter((task) => task.isActive !== false)
      .map((task) => ({
        id: task.id,
        title: task.title,
        kind: task.kind,
        createdAt: Date.parse(task.createdAt) || Date.now(),
      })),
    money: (moneyTasks as MoneyTask[]).map((task) => ({
      id: task.id ?? 0,
      title: task.title,
      kind: task.priority,
      createdAt: task.createdAt,
    })),
    general: (generalTasks as GeneralTask[]).map((task) => ({
      id: task.id ?? 0,
      title: task.title,
      kind: task.priority,
      createdAt: task.createdAt,
    })),
  };
}

export async function getCompletionsByEngineForRange(
  startISO: string,
  endISO: string,
): Promise<Record<EngineId, EngineCompletion[]>> {
  const safeStart = assertDateISO(startISO);
  const safeEnd = assertDateISO(endISO);

  const [bodyLogs, moneyLogs, generalLogs, mindCompletions] = await Promise.all([
    db.body_logs.toArray(),
    db.money_logs.toArray(),
    db.general_logs.toArray(),
    db.mind_task_completions.toArray(),
  ]);

  const inRange = (dateISO: string) => isDateInRangeISO(dateISO, safeStart, safeEnd, { endInclusive: false });

  const body: EngineCompletion[] = [];
  bodyLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (!inRange(log.dateKey)) return;
    log.completedTaskIds.forEach((id) => body.push({ dateISO: log.dateKey, taskId: id }));
  });

  const money: EngineCompletion[] = [];
  moneyLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (!inRange(log.dateKey)) return;
    log.completedTaskIds.forEach((id) => money.push({ dateISO: log.dateKey, taskId: id }));
  });

  const general: EngineCompletion[] = [];
  generalLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (!inRange(log.dateKey)) return;
    log.completedTaskIds.forEach((id) => general.push({ dateISO: log.dateKey, taskId: id }));
  });

  const mind: EngineCompletion[] = [];
  mindCompletions.forEach((entry) => {
    if (!entry.completed) return;
    if (typeof entry.dateKey !== "string") return;
    if (!inRange(entry.dateKey)) return;
    mind.push({ dateISO: entry.dateKey, taskId: entry.taskId });
  });

  return { body, mind, money, general };
}

export function computeDailyScore(tasks: EngineTask[], completionSet: Set<string | number>): DailyScore {
  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completionSet.has(task.id)).length;
  const secondaryDone = secondaryTasks.filter((task) => completionSet.has(task.id)).length;
  return computeDayScoreFromCounts(mainTasks.length, mainDone, secondaryTasks.length, secondaryDone);
}

export function titanDailyScore(scores: Record<EngineId, DailyScore>) {
  return computeTitanPercent(listEngines().map((engine) => scores[engine]));
}
