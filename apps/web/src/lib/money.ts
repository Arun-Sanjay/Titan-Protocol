import { db, type MoneyLog, type MoneyMeta, type MoneyTask } from "./db";
import { computeBodyDayScore } from "./bodyScore";
import { assertDateISO } from "./date";

export async function ensureMoneyMeta(dateKey: string): Promise<MoneyMeta> {
  const safeDate = assertDateISO(dateKey);
  const existing = await db.money_meta.get("money");
  if (existing) return existing;
  const meta: MoneyMeta = { id: "money", startDate: safeDate, createdAt: Date.now() };
  await db.money_meta.put(meta);
  return meta;
}

export async function getMoneyStartDate(): Promise<string | null> {
  const meta = await db.money_meta.get("money");
  return meta?.startDate ?? null;
}

export async function listMoneyTasks(): Promise<MoneyTask[]> {
  return db.money_tasks.toArray();
}

export async function addMoneyTask(title: string, priority: "main" | "secondary"): Promise<number> {
  return db.money_tasks.add({
    title,
    priority,
    createdAt: Date.now(),
  });
}

export async function updateMoneyTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await db.money_tasks.update(taskId, { priority });
}

export async function renameMoneyTask(taskId: number, title: string): Promise<void> {
  await db.money_tasks.update(taskId, { title });
}

export async function deleteMoneyTask(taskId: number): Promise<void> {
  await db.money_tasks.delete(taskId);
  const logs = await db.money_logs.toArray();
  await Promise.all(
    logs.map(async (log) => {
      if (!log.completedTaskIds.includes(taskId) || !log.id) return;
      const nextIds = log.completedTaskIds.filter((id) => id !== taskId);
      await db.money_logs.update(log.id, { completedTaskIds: nextIds });
    }),
  );
}

export async function getMoneyLog(dateKey: string): Promise<MoneyLog | undefined> {
  const safeDate = assertDateISO(dateKey);
  return db.money_logs.where("dateKey").equals(safeDate).first();
}

export async function getOrCreateMoneyLog(dateKey: string): Promise<MoneyLog> {
  const safeDate = assertDateISO(dateKey);
  const existing = await getMoneyLog(safeDate);
  if (existing) return existing;
  const id = await db.money_logs.add({ dateKey: safeDate, completedTaskIds: [], createdAt: Date.now() });
  return { id, dateKey: safeDate, completedTaskIds: [], createdAt: Date.now() };
}

export async function toggleMoneyTaskForDate(dateKey: string, taskId: number): Promise<MoneyLog> {
  const safeDate = assertDateISO(dateKey);
  const log = await getOrCreateMoneyLog(safeDate);
  const exists = log.completedTaskIds.includes(taskId);
  const nextIds = exists ? log.completedTaskIds.filter((id) => id !== taskId) : [...log.completedTaskIds, taskId];
  if (log.id) {
    await db.money_logs.update(log.id, { completedTaskIds: nextIds });
  }
  const meta = await ensureMoneyMeta(safeDate);
  if (safeDate < meta.startDate) {
    await db.money_meta.update("money", { startDate: safeDate });
  }
  return { ...log, completedTaskIds: nextIds };
}

export function computeMoneyDayScoreFromLog(tasks: MoneyTask[], completedTaskIds: number[]) {
  const completedSet = new Set(completedTaskIds);
  const tasksWithCompletion = tasks.map((task) => ({
    ...task,
    completed: completedSet.has(task.id ?? -1),
  }));
  return computeBodyDayScore(tasksWithCompletion as Array<MoneyTask & { completed: boolean }>);
}

export async function getMoneyScoreMapForRange(startKey: string, endKey: string): Promise<Record<string, number>> {
  const safeStart = assertDateISO(startKey);
  const safeEnd = assertDateISO(endKey);
  const [tasks, logs] = await Promise.all([db.money_tasks.toArray(), db.money_logs.toArray()]);
  const map: Record<string, number> = {};
  for (const log of logs) {
    if (typeof log.dateKey !== "string") continue;
    if (log.dateKey < safeStart || log.dateKey > safeEnd) continue;
    map[log.dateKey] = computeMoneyDayScoreFromLog(tasks, log.completedTaskIds).percent;
  }
  return map;
}
