import { db, type GeneralLog, type GeneralMeta, type GeneralTask } from "./db";
import { computeBodyDayScore } from "./bodyScore";
import { assertDateISO } from "./date";

export async function ensureGeneralMeta(dateKey: string): Promise<GeneralMeta> {
  const safeDate = assertDateISO(dateKey);
  const existing = await db.general_meta.get("general");
  if (existing) return existing;
  const meta: GeneralMeta = { id: "general", startDate: safeDate, createdAt: Date.now() };
  await db.general_meta.put(meta);
  return meta;
}

export async function getGeneralStartDate(): Promise<string | null> {
  const meta = await db.general_meta.get("general");
  return meta?.startDate ?? null;
}

export async function listGeneralTasks(): Promise<GeneralTask[]> {
  return db.general_tasks.toArray();
}

export async function addGeneralTask(title: string, priority: "main" | "secondary"): Promise<number> {
  return db.general_tasks.add({
    title,
    priority,
    createdAt: Date.now(),
  });
}

export async function updateGeneralTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await db.general_tasks.update(taskId, { priority });
}

export async function renameGeneralTask(taskId: number, title: string): Promise<void> {
  await db.general_tasks.update(taskId, { title });
}

export async function deleteGeneralTask(taskId: number): Promise<void> {
  await db.general_tasks.delete(taskId);
  const logs = await db.general_logs.toArray();
  await Promise.all(
    logs.map(async (log) => {
      if (!log.completedTaskIds.includes(taskId) || !log.id) return;
      const nextIds = log.completedTaskIds.filter((id) => id !== taskId);
      await db.general_logs.update(log.id, { completedTaskIds: nextIds });
    }),
  );
}

export async function getGeneralLog(dateKey: string): Promise<GeneralLog | undefined> {
  const safeDate = assertDateISO(dateKey);
  return db.general_logs.where("dateKey").equals(safeDate).first();
}

export async function getOrCreateGeneralLog(dateKey: string): Promise<GeneralLog> {
  const safeDate = assertDateISO(dateKey);
  const existing = await getGeneralLog(safeDate);
  if (existing) return existing;
  const id = await db.general_logs.add({ dateKey: safeDate, completedTaskIds: [], createdAt: Date.now() });
  return { id, dateKey: safeDate, completedTaskIds: [], createdAt: Date.now() };
}

export async function toggleGeneralTaskForDate(dateKey: string, taskId: number): Promise<GeneralLog> {
  const safeDate = assertDateISO(dateKey);
  const log = await getOrCreateGeneralLog(safeDate);
  const exists = log.completedTaskIds.includes(taskId);
  const nextIds = exists ? log.completedTaskIds.filter((id) => id !== taskId) : [...log.completedTaskIds, taskId];
  if (log.id) {
    await db.general_logs.update(log.id, { completedTaskIds: nextIds });
  }
  const meta = await ensureGeneralMeta(safeDate);
  if (safeDate < meta.startDate) {
    await db.general_meta.update("general", { startDate: safeDate });
  }
  return { ...log, completedTaskIds: nextIds };
}

export function computeGeneralDayScoreFromLog(tasks: GeneralTask[], completedTaskIds: number[]) {
  const completedSet = new Set(completedTaskIds);
  const tasksWithCompletion = tasks.map((task) => ({
    ...task,
    completed: completedSet.has(task.id ?? -1),
  }));
  return computeBodyDayScore(tasksWithCompletion as Array<GeneralTask & { completed: boolean }>);
}

export async function getGeneralScoreMapForRange(startKey: string, endKey: string): Promise<Record<string, number>> {
  const safeStart = assertDateISO(startKey);
  const safeEnd = assertDateISO(endKey);
  const [tasks, logs] = await Promise.all([db.general_tasks.toArray(), db.general_logs.toArray()]);
  const map: Record<string, number> = {};
  for (const log of logs) {
    if (typeof log.dateKey !== "string") continue;
    if (log.dateKey < safeStart || log.dateKey > safeEnd) continue;
    map[log.dateKey] = computeGeneralDayScoreFromLog(tasks, log.completedTaskIds).percent;
  }
  return map;
}
