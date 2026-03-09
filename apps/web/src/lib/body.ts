import { createEngineTaskLogHelpers, db, type BodyLog, type BodyMeta, type BodyTask } from "./db";
import { computeBodyDayScore } from "./bodyScore";
import { assertDateISO } from "./date";

export async function ensureBodyMeta(todayKey: string): Promise<BodyMeta> {
  const safeDate = assertDateISO(todayKey);
  const existing = await db.body_meta.get("body");
  if (existing) return existing;
  const meta: BodyMeta = { id: "body", startDate: safeDate, createdAt: Date.now() };
  await db.body_meta.put(meta);
  return meta;
}

export async function getBodyStartDate(): Promise<string | null> {
  const meta = await db.body_meta.get("body");
  return meta?.startDate ?? null;
}

export async function listBodyTasks(): Promise<BodyTask[]> {
  return bodyTaskLog.listTasks();
}

export async function addBodyTask(
  title: string,
  priority: "main" | "secondary",
  daysPerWeek = 7,
): Promise<number> {
  return bodyTaskLog.addTask(title, priority, daysPerWeek);
}

export async function updateBodyTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await bodyTaskLog.updateTaskPriority(taskId, priority);
}

export async function renameBodyTask(taskId: number, title: string): Promise<void> {
  await bodyTaskLog.renameTask(taskId, title);
}

export async function deleteBodyTask(taskId: number): Promise<void> {
  await bodyTaskLog.deleteTask(taskId);
}

export async function getBodyLog(dateKey: string): Promise<BodyLog | undefined> {
  return bodyTaskLog.getLog(dateKey);
}

export async function getOrCreateBodyLog(dateKey: string): Promise<BodyLog> {
  return bodyTaskLog.getOrCreateLog(dateKey);
}

export async function toggleBodyTaskForDate(dateKey: string, taskId: number): Promise<BodyLog> {
  return bodyTaskLog.toggleTaskForDate(dateKey, taskId);
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
  return bodyTaskLog.getScoreMapForRange(startKey, endKey);
}

async function touchBodyDate(dateKey: string): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  const meta = await ensureBodyMeta(safeDate);
  if (safeDate < meta.startDate) {
    await db.body_meta.update("body", { startDate: safeDate });
  }
}

const bodyTaskLog = createEngineTaskLogHelpers<BodyTask, BodyLog>({
  taskTable: db.body_tasks,
  logTable: db.body_logs,
  computePercentFromLog: (tasks, completedTaskIds) => computeBodyDayScoreFromLog(tasks, completedTaskIds).percent,
  onDateTouched: touchBodyDate,
});
