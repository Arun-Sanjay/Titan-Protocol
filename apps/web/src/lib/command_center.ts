import { db, type BodyTask, type MindTask, type MoneyTask, type GeneralTask } from "./db";
import { assertDateISO, isDateInRangeISO, todayISO } from "./date";
import { addBodyTask, getBodyLog, toggleBodyTaskForDate } from "./body";
import { addMindTask, listMindCompletions, listMindTasks, setMindTaskCompletion } from "./mind";
import { addMoneyTask, getMoneyLog, toggleMoneyTaskForDate } from "./money";
import { addGeneralTask, getGeneralLog, toggleGeneralTaskForDate } from "./general";
import { computeDayScoreFromCounts } from "./scoring";

export type UnifiedTask = {
  id: string;
  engine: "body" | "mind" | "money" | "general";
  rawId: string | number;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
};

export type UnifiedTaskDraft = {
  engine: UnifiedTask["engine"];
  title: string;
  kind: UnifiedTask["kind"];
  daysPerWeek?: number;
  dateISO?: string;
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
    createdAt: Date.parse(task.createdAt) || Date.now(),
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
  mindCompletions.filter((c) => c.completed).forEach((c) => set.add(`mind:${c.taskId}`));
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
    if (!isDateInRangeISO(log.dateKey, safeStart, safeEnd)) return;
    log.completedTaskIds.forEach((id) => add(log.dateKey, `body:${id}`));
  });

  moneyLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (!isDateInRangeISO(log.dateKey, safeStart, safeEnd)) return;
    log.completedTaskIds.forEach((id) => add(log.dateKey, `money:${id}`));
  });

  generalLogs.forEach((log) => {
    if (typeof log.dateKey !== "string") return;
    if (!isDateInRangeISO(log.dateKey, safeStart, safeEnd)) return;
    log.completedTaskIds.forEach((id) => add(log.dateKey, `general:${id}`));
  });

  mindCompletions.forEach((entry) => {
    if (typeof entry.dateKey !== "string") return;
    if (!isDateInRangeISO(entry.dateKey, safeStart, safeEnd)) return;
    if (!entry.completed) return;
    add(entry.dateKey, `mind:${entry.taskId}`);
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

export async function addTaskToEngine(draft: UnifiedTaskDraft): Promise<void> {
  const title = draft.title.trim();
  if (!title) {
    throw new Error("Task title is required.");
  }
  const safeDays = Math.min(7, Math.max(1, Math.floor(draft.daysPerWeek ?? 7)));

  if (draft.engine === "body") {
    await addBodyTask(title, draft.kind, safeDays);
    return;
  }
  if (draft.engine === "money") {
    await addMoneyTask(title, draft.kind, safeDays);
    return;
  }
  if (draft.engine === "general") {
    await addGeneralTask(title, draft.kind, safeDays);
    return;
  }
  if (draft.engine === "mind") {
    await addMindTask({
      title,
      kind: draft.kind,
      daysPerWeek: safeDays,
      dateISO: draft.dateISO ?? todayISO(),
    });
    return;
  }
  throw new Error("Unsupported engine.");
}

export function computeDayScore(tasks: UnifiedTask[], completionSet: Set<string>) {
  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completionSet.has(task.id)).length;
  const secondaryDone = secondaryTasks.filter((task) => completionSet.has(task.id)).length;
  return computeDayScoreFromCounts(mainTasks.length, mainDone, secondaryTasks.length, secondaryDone);
}
