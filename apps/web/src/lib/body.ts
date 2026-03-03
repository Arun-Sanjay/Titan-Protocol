import { db, type BodyLog, type BodyMeta, type BodyTask } from "./db";
import { computeBodyDayScore } from "./bodyScore";

export async function ensureBodyMeta(todayKey: string): Promise<BodyMeta> {
  const existing = await db.body_meta.get("body");
  if (existing) return existing;
  const meta: BodyMeta = { id: "body", startDate: todayKey, createdAt: Date.now() };
  await db.body_meta.put(meta);
  return meta;
}

export async function getBodyStartDate(): Promise<string | null> {
  const meta = await db.body_meta.get("body");
  return meta?.startDate ?? null;
}

export async function listBodyTasks(): Promise<BodyTask[]> {
  return db.body_tasks.toArray();
}

export async function addBodyTask(
  title: string,
  priority: "main" | "secondary",
): Promise<number> {
  return db.body_tasks.add({
    title,
    priority,
    createdAt: Date.now(),
  });
}

export async function updateBodyTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await db.body_tasks.update(taskId, { priority });
}

export async function renameBodyTask(taskId: number, title: string): Promise<void> {
  await db.body_tasks.update(taskId, { title });
}

export async function deleteBodyTask(taskId: number): Promise<void> {
  await db.body_tasks.delete(taskId);
  const logs = await db.body_logs.toArray();
  await Promise.all(
    logs.map(async (log) => {
      if (!log.completedTaskIds.includes(taskId) || !log.id) return;
      const nextIds = log.completedTaskIds.filter((id) => id !== taskId);
      await db.body_logs.update(log.id, { completedTaskIds: nextIds });
    }),
  );
}

export async function getBodyLog(dateKey: string): Promise<BodyLog | undefined> {
  return db.body_logs.where("dateKey").equals(dateKey).first();
}

export async function getOrCreateBodyLog(dateKey: string): Promise<BodyLog> {
  const existing = await getBodyLog(dateKey);
  if (existing) return existing;
  const id = await db.body_logs.add({ dateKey, completedTaskIds: [], createdAt: Date.now() });
  return { id, dateKey, completedTaskIds: [], createdAt: Date.now() };
}

export async function toggleBodyTaskForDate(dateKey: string, taskId: number): Promise<BodyLog> {
  const log = await getOrCreateBodyLog(dateKey);
  const exists = log.completedTaskIds.includes(taskId);
  const nextIds = exists ? log.completedTaskIds.filter((id) => id !== taskId) : [...log.completedTaskIds, taskId];
  if (log.id) {
    await db.body_logs.update(log.id, { completedTaskIds: nextIds });
  }
  const meta = await ensureBodyMeta(dateKey);
  if (dateKey < meta.startDate) {
    await db.body_meta.update("body", { startDate: dateKey });
  }
  return { ...log, completedTaskIds: nextIds };
}

export function computeBodyDayScoreFromLog(tasks: BodyTask[], completedTaskIds: number[]) {
  const completedSet = new Set(completedTaskIds);
  const tasksWithCompletion = tasks.map((task) => ({
    ...task,
    completed: completedSet.has(task.id ?? -1),
  }));
  return computeBodyDayScore(tasksWithCompletion as Array<BodyTask & { completed: boolean }>);
}

export async function getBodyScoreMapForRange(
  startKey: string,
  endKey: string,
): Promise<Record<string, number>> {
  const [tasks, logs] = await Promise.all([
    db.body_tasks.toArray(),
    db.body_logs.where("dateKey").between(startKey, endKey, true, true).toArray(),
  ]);
  const map: Record<string, number> = {};
  for (const log of logs) {
    map[log.dateKey] = computeBodyDayScoreFromLog(tasks, log.completedTaskIds).percent;
  }
  return map;
}
