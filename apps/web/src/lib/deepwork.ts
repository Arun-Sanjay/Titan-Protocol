import { db } from "./db";
import { assertDateISO, todayISO } from "./date";
import type { DeepWorkTask } from "./db";

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/** Return every deep-work task. */
export async function listDeepWorkTasks(): Promise<DeepWorkTask[]> {
  return db.deep_work_tasks.toArray();
}

/** Return all deep-work logs whose dateKey matches the given date. */
export async function getDeepWorkLogsForDate(dateKey: string) {
  const key = assertDateISO(dateKey);
  return db.deep_work_logs.where("dateKey").equals(key).toArray();
}

/** Sum of earningsToday for every log on a given date. */
export async function getDeepWorkEarningsToday(dateKey: string): Promise<number> {
  const key = assertDateISO(dateKey);
  const logs = await db.deep_work_logs.where("dateKey").equals(key).toArray();
  return logs.reduce((sum, log) => sum + (log.earningsToday ?? 0), 0);
}

/** Sum of earningsToday for the ISO-week (Mon-Sun) that contains dateKey. */
export async function getDeepWorkEarningsWeek(dateKey: string): Promise<number> {
  const key = assertDateISO(dateKey);
  const d = new Date(key + "T00:00:00");
  // JS getDay(): 0=Sun  We want Mon=0 ... Sun=6
  const jsDay = d.getDay();
  const dayOffset = jsDay === 0 ? 6 : jsDay - 1; // Mon=0
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const startKey = fmt(monday);
  const endKey = fmt(sunday);

  const logs = await db.deep_work_logs
    .where("dateKey")
    .between(startKey, endKey, true, true)
    .toArray();

  return logs.reduce((sum, log) => sum + (log.earningsToday ?? 0), 0);
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/** Add a new deep-work task. Returns the auto-generated id. */
export async function addDeepWorkTask(
  taskName: string,
  category: DeepWorkTask["category"],
): Promise<number> {
  return db.deep_work_tasks.add({
    taskName,
    category,
    createdAt: Date.now(),
  });
}

/** Delete a deep-work task AND all of its associated logs. */
export async function deleteDeepWorkTask(taskId: number): Promise<void> {
  await db.transaction("rw", db.deep_work_tasks, db.deep_work_logs, async () => {
    await db.deep_work_logs.where("taskId").equals(taskId).delete();
    await db.deep_work_tasks.delete(taskId);
  });
}

/**
 * Toggle the completion status of a task for a given date.
 *
 * If no log exists for (taskId, dateKey) yet, one is created with
 * completed = true and earningsToday = 0.
 * If a log already exists its `completed` flag is flipped.
 */
export async function toggleDeepWorkCompletion(
  taskId: number,
  dateKey: string,
): Promise<void> {
  const key = assertDateISO(dateKey);

  await db.transaction("rw", db.deep_work_logs, async () => {
    const existing = await db.deep_work_logs
      .where("taskId")
      .equals(taskId)
      .and((log) => log.dateKey === key)
      .first();

    if (existing) {
      await db.deep_work_logs.update(existing.id!, {
        completed: !existing.completed,
      });
    } else {
      await db.deep_work_logs.add({
        taskId,
        dateKey: key,
        completed: true,
        earningsToday: 0,
      });
    }
  });
}

/** Update the earningsToday value for a specific log entry. */
export async function updateDeepWorkEarnings(
  logId: number,
  earnings: number,
): Promise<void> {
  await db.deep_work_logs.update(logId, { earningsToday: earnings });
}
