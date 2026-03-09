import { db, type BodyTask, type MindTask, type MoneyTask, type GeneralTask } from "./db";
import { assertDateISO, todayISO } from "./date";
import { getBodyLog, toggleBodyTaskForDate } from "./body";
import { listMindCompletions, listMindTasks, setMindTaskCompletion } from "./mind";
import { getMoneyLog, toggleMoneyTaskForDate } from "./money";
import { getGeneralLog, toggleGeneralTaskForDate } from "./general";

export type UnifiedTask = {
  id: string;
  engine: "body" | "mind" | "money" | "general";
  rawId: string | number;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
};

export async function listAllTasks(): Promise<UnifiedTask[]> {
  const [bodyTasks, mindTasks, moneyTasks, generalTasks] = await Promise.all([
    db.body_tasks.toArray(),
    listMindTasks(),
    db.money_tasks.toArray(),
    db.general_tasks.toArray(),
  ]);

  const body = (bodyTasks as BodyTask[])
    .filter((task) => typeof task.id === "number")
    .map((task) => ({
      id: `body:${task.id}`,
      engine: "body" as const,
      rawId: task.id as number,
      title: task.title,
      kind: task.priority,
      createdAt: task.createdAt,
    }));

  const mind = (mindTasks as MindTask[]).map((task) => ({
    id: `mind:${task.id}`,
    engine: "mind" as const,
    rawId: task.id,
    title: task.title,
    kind: task.kind,
    createdAt: Date.parse(task.created_at) || Date.now(),
  }));

  const money = (moneyTasks as MoneyTask[])
    .filter((task) => typeof task.id === "number")
    .map((task) => ({
      id: `money:${task.id}`,
      engine: "money" as const,
      rawId: task.id as number,
      title: task.title,
      kind: task.priority,
      createdAt: task.createdAt,
    }));

  const general = (generalTasks as GeneralTask[])
    .filter((task) => typeof task.id === "number")
    .map((task) => ({
      id: `general:${task.id}`,
      engine: "general" as const,
      rawId: task.id as number,
      title: task.title,
      kind: task.priority,
      createdAt: task.createdAt,
    }));

  return [...body, ...mind, ...money, ...general];
}

export async function getCompletionMap(dateISO: string): Promise<Set<string>> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const [bodyLog, moneyLog, generalLog, mindCompletions] = await Promise.all([
    getBodyLog(safeDate),
    getMoneyLog(safeDate),
    getGeneralLog(safeDate),
    listMindCompletions(safeDate),
  ]);

  const set = new Set<string>();
  bodyLog?.completedTaskIds.forEach((id) => set.add(`body:${id}`));
  moneyLog?.completedTaskIds.forEach((id) => set.add(`money:${id}`));
  generalLog?.completedTaskIds.forEach((id) => set.add(`general:${id}`));
  mindCompletions.filter((c) => c.completed).forEach((c) => set.add(`mind:${c.task_id}`));
  return set;
}

export async function getCompletionMapForRange(startISO: string, endISO: string) {
  const safeStart = assertDateISO(startISO);
  const safeEnd = assertDateISO(endISO);
  const map = new Map<string, Set<string>>();

  const [bodyLogs, moneyLogs, generalLogs, mindCompletions] = await Promise.all([
    db.body_logs.toArray(),
    db.money_logs.toArray(),
    db.general_logs.toArray(),
    db.mind_task_completions.toArray(),
  ]);

  const add = (dateKey: string, id: string) => {
    const set = map.get(dateKey) ?? new Set<string>();
    set.add(id);
    map.set(dateKey, set);
  };

  bodyLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (log.dateKey < safeStart || log.dateKey > safeEnd) return;
    log.completedTaskIds.forEach((id) => add(log.dateKey, `body:${id}`));
  });

  moneyLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (log.dateKey < safeStart || log.dateKey > safeEnd) return;
    log.completedTaskIds.forEach((id) => add(log.dateKey, `money:${id}`));
  });

  generalLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (log.dateKey < safeStart || log.dateKey > safeEnd) return;
    log.completedTaskIds.forEach((id) => add(log.dateKey, `general:${id}`));
  });

  mindCompletions.forEach((entry) => {
    if (typeof entry.dateISO !== "string") return;
    if (entry.dateISO < safeStart || entry.dateISO > safeEnd) return;
    if (!entry.completed) return;
    add(entry.dateISO, `mind:${entry.task_id}`);
  });

  return map;
}

export async function toggleTaskCompletion(normalizedId: string, dateISO: string, completed?: boolean) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const [engine, raw] = normalizedId.split(":");
  if (!engine || raw === undefined) return;

  if (engine === "mind") {
    const next = completed ? false : true;
    await setMindTaskCompletion(safeDate, raw, next);
    return;
  }
  if (engine === "body") {
    await toggleBodyTaskForDate(safeDate, Number(raw));
    return;
  }
  if (engine === "money") {
    await toggleMoneyTaskForDate(safeDate, Number(raw));
    return;
  }
  if (engine === "general") {
    await toggleGeneralTaskForDate(safeDate, Number(raw));
  }
}

export function computeDayScore(tasks: UnifiedTask[], completionSet: Set<string>) {
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
