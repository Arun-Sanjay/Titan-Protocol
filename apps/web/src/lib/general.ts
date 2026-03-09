import { createEngineTaskLogHelpers, db, type GeneralLog, type GeneralMeta, type GeneralTask } from "./db";
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
  return generalTaskLog.listTasks();
}

export async function addGeneralTask(title: string, priority: "main" | "secondary", daysPerWeek = 7): Promise<number> {
  return generalTaskLog.addTask(title, priority, daysPerWeek);
}

export async function updateGeneralTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await generalTaskLog.updateTaskPriority(taskId, priority);
}

export async function renameGeneralTask(taskId: number, title: string): Promise<void> {
  await generalTaskLog.renameTask(taskId, title);
}

export async function deleteGeneralTask(taskId: number): Promise<void> {
  await generalTaskLog.deleteTask(taskId);
}

export async function getGeneralLog(dateKey: string): Promise<GeneralLog | undefined> {
  return generalTaskLog.getLog(dateKey);
}

export async function getOrCreateGeneralLog(dateKey: string): Promise<GeneralLog> {
  return generalTaskLog.getOrCreateLog(dateKey);
}

export async function toggleGeneralTaskForDate(dateKey: string, taskId: number): Promise<GeneralLog> {
  return generalTaskLog.toggleTaskForDate(dateKey, taskId);
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
  return generalTaskLog.getScoreMapForRange(startKey, endKey);
}

async function touchGeneralDate(dateKey: string): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  const meta = await ensureGeneralMeta(safeDate);
  if (safeDate < meta.startDate) {
    await db.general_meta.update("general", { startDate: safeDate });
  }
}

const generalTaskLog = createEngineTaskLogHelpers<GeneralTask, GeneralLog>({
  taskTable: db.general_tasks,
  logTable: db.general_logs,
  computePercentFromLog: (tasks, completedTaskIds) => computeGeneralDayScoreFromLog(tasks, completedTaskIds).percent,
  onDateTouched: touchGeneralDate,
});
