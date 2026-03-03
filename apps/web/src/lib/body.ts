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

export async function listBodyTasksByDate(dateKey: string): Promise<BodyTask[]> {
  return db.body_tasks.where("dateKey").equals(dateKey).toArray();
}

export async function addBodyTask(
  dateKey: string,
  title: string,
  priority: "main" | "secondary",
): Promise<number> {
  return db.body_tasks.add({
    dateKey,
    title,
    priority,
    completed: false,
    createdAt: Date.now(),
  });
}

export async function toggleBodyTask(taskId: number, completed: boolean): Promise<void> {
  await db.body_tasks.update(taskId, { completed });
}

export async function updateBodyTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await db.body_tasks.update(taskId, { priority });
}

export async function deleteBodyTask(taskId: number): Promise<void> {
  await db.body_tasks.delete(taskId);
}

export async function getBodyLog(dateKey: string): Promise<BodyLog | undefined> {
  return db.body_logs.where("dateKey").equals(dateKey).first();
}

export async function upsertBodyLog(dateKey: string, completedTaskIds: number[]): Promise<void> {
  const existing = await getBodyLog(dateKey);
  if (existing?.id) {
    await db.body_logs.update(existing.id, { completedTaskIds });
    return;
  }
  await db.body_logs.add({ dateKey, completedTaskIds, createdAt: Date.now() });
}

export async function getBodyScoreMapForRange(
  startKey: string,
  endKey: string,
): Promise<Record<string, number>> {
  const tasks = await db.body_tasks
    .where("dateKey")
    .between(startKey, endKey, true, true)
    .toArray();
  const bucket: Record<string, BodyTask[]> = {};
  for (const task of tasks) {
    if (!bucket[task.dateKey]) bucket[task.dateKey] = [];
    bucket[task.dateKey].push(task);
  }
  const map: Record<string, number> = {};
  for (const [dateKey, dateTasks] of Object.entries(bucket)) {
    map[dateKey] = computeBodyDayScore(dateTasks).percent;
  }
  return map;
}
