import { db, type BodyTask, type GeneralTask, type MindTask, type MoneyTask } from "./db";
import { assertDateISO } from "./date";

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

export type DailyScore = {
  percent: number;
  mainDone: number;
  mainTotal: number;
  secondaryDone: number;
  secondaryTotal: number;
  pointsDone: number;
  pointsTotal: number;
};

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
      .filter((task) => task.is_active !== false)
      .map((task) => ({
        id: task.id,
        title: task.title,
        kind: task.kind,
        createdAt: Date.parse(task.created_at) || Date.now(),
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

  const inRange = (dateISO: string) => dateISO >= safeStart && dateISO < safeEnd;

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
    if (typeof entry.dateISO !== "string") return;
    if (!inRange(entry.dateISO)) return;
    mind.push({ dateISO: entry.dateISO, taskId: entry.task_id });
  });

  return { body, mind, money, general };
}

export function computeDailyScore(tasks: EngineTask[], completionSet: Set<string | number>): DailyScore {
  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completionSet.has(task.id)).length;
  const secondaryDone = secondaryTasks.filter((task) => completionSet.has(task.id)).length;
  const mainTotal = mainTasks.length;
  const secondaryTotal = secondaryTasks.length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);

  return { percent, mainDone, mainTotal, secondaryDone, secondaryTotal, pointsDone, pointsTotal };
}

export function titanDailyScore(scores: Record<EngineId, DailyScore>) {
  const engines = listEngines();
  const available = engines.filter((engine) => scores[engine].pointsTotal > 0);
  if (available.length === 0) return 0;
  const sum = available.reduce((acc, engine) => acc + scores[engine].percent, 0);
  return Math.round(sum / available.length);
}
