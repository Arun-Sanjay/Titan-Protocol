import { addDaysISO, diffDaysISO, toISODateLocal } from "./date";
import { listProgramTasks, getTaskLogMapForRange } from "./tasks";
import { db } from "./db";

type WindowResult = {
  startDate: string;
  endDate: string;
  days: string[];
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function eachDate(startDate: string, endDate: string): string[] {
  if (endDate < startDate) return [];
  const values: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    values.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return values;
}

export const NO_TASKS_POLICY: "red" | "neutralGray" = "neutralGray";

export type DailyCompletionCounts = {
  totalAll: number;
  completedAll: number;
  totalLocked: number;
  completedLocked: number;
};

export type DayCounts = DailyCompletionCounts;

function normalizeProgramId(programId: number | string): number {
  if (typeof programId === "number") return programId;
  const parsed = Number.parseInt(programId, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("programId must be a number");
  }
  return parsed;
}

export function getWindow(programStartDate: string, windowIndex: number): WindowResult {
  if (!isIsoDate(programStartDate)) {
    throw new Error("programStartDate must be YYYY-MM-DD");
  }
  const safeWindow = Math.max(0, Math.floor(windowIndex));
  const startDate = addDaysISO(programStartDate, safeWindow * 30);
  const endDate = addDaysISO(startDate, 29);
  return {
    startDate,
    endDate,
    days: eachDate(startDate, endDate),
  };
}

export async function getWindowSquares(
  programId: number,
  windowStartDate: string,
  windowEndDate: string,
): Promise<
  Array<{
    date: string;
    completed: number;
    total: number;
    pct: number;
  }>
> {
  if (!isIsoDate(windowStartDate) || !isIsoDate(windowEndDate)) {
    throw new Error("window dates must be YYYY-MM-DD");
  }
  const [tasks, logsByDate] = await Promise.all([
    listProgramTasks(programId),
    getTaskLogMapForRange(programId, windowStartDate, windowEndDate),
  ]);

  const activeTaskIds = new Set(tasks.filter((task) => task.isActive && task.id).map((task) => task.id as number));
  const total = activeTaskIds.size;

  return eachDate(windowStartDate, windowEndDate).map((date) => {
    const logs = logsByDate.get(date) ?? [];
    const completed = logs.filter((log) => log.completed && activeTaskIds.has(log.taskId)).length;
    return {
      date,
      completed,
      total,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
}

export async function getProgramAverageConsistency(
  programId: number,
  startDate: string,
  endDate?: string,
): Promise<number> {
  const today = toISODateLocal(new Date());
  const windowEnd = endDate ?? today;
  if (windowEnd < startDate) return 0;
  const rows = await getWindowSquares(programId, startDate, windowEnd);
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + row.pct, 0);
  return Math.round(total / rows.length);
}

export function getDayIndex(startDate: string, date: string): number {
  return Math.max(1, diffDaysISO(startDate, date) + 1);
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export async function getDailyTaskPctMap(
  programId: number,
  startDate: string,
  endDate: string,
  source: "body" | "mind" = "body",
): Promise<Record<string, number>> {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (endDate < startDate) return {};

  const dates = eachDate(startDate, endDate);
  const emptyValue = NO_TASKS_POLICY === "neutralGray" ? -1 : 0;
  const pctMap: Record<string, number> = {};
  for (const date of dates) pctMap[date] = emptyValue;

  if (source === "mind") {
    const [tasks, logs] = await Promise.all([
      db.mind_tasks.where("program_id").equals(programId).toArray(),
      db.mind_day_logs.where("program_id").equals(programId).toArray(),
    ]);
    const activeTaskIds = new Set(
      tasks.filter((task) => task.is_active !== false && task.id).map((task) => String(task.id)),
    );
    const total = activeTaskIds.size;
    if (total === 0) return pctMap;

    for (const log of logs) {
      if (log.date_iso < startDate || log.date_iso > endDate) continue;
      const completed = (log.completed_task_ids ?? []).filter((taskId) => activeTaskIds.has(taskId)).length;
      pctMap[log.date_iso] = clampPct(completed / total);
    }
    return pctMap;
  }

  const [tasks, logs] = await Promise.all([
    db.body_program_tasks.where("program_id").equals(programId).toArray(),
    db.body_day_logs.where("program_id").equals(programId).toArray(),
  ]);
  const activeTaskIds = new Set(
    tasks.filter((task) => task.is_active && task.id).map((task) => String(task.id)),
  );
  const total = activeTaskIds.size;
  if (total === 0) return pctMap;

  for (const log of logs) {
    if (log.date_iso < startDate || log.date_iso > endDate) continue;
    const completed = (log.completed_task_ids ?? []).filter((taskId) => activeTaskIds.has(taskId)).length;
    pctMap[log.date_iso] = clampPct(completed / total);
  }
  return pctMap;
}

export async function getDailyCompletionMap(
  programId: number | string,
  startDate: string,
  endDate: string,
  source: "body" | "mind" = "body",
): Promise<Record<string, DailyCompletionCounts>> {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (endDate < startDate) return {};

  const normalizedProgramId = normalizeProgramId(programId);
  const dates = eachDate(startDate, endDate);
  const map: Record<string, DailyCompletionCounts> = {};
  for (const date of dates) {
    map[date] = {
      totalAll: 0,
      completedAll: 0,
      totalLocked: 0,
      completedLocked: 0,
    };
  }

  if (source === "mind") {
    const [tasks, logs] = await Promise.all([
      db.mind_tasks.where("program_id").equals(normalizedProgramId).toArray(),
      db.mind_day_logs
        .where("program_id")
        .equals(normalizedProgramId)
        .and((row) => row.date_iso >= startDate && row.date_iso <= endDate)
        .toArray(),
    ]);
    const activeTasks = tasks.filter((task) => task.is_active !== false && task.id);
    const activeAllIds = new Set(activeTasks.map((task) => String(task.id)));
    const activeLockedIds = new Set(
      activeTasks.filter((task) => task.locked).map((task) => String(task.id)),
    );

    for (const date of dates) {
      map[date].totalAll = activeAllIds.size;
      map[date].totalLocked = activeLockedIds.size;
    }

    for (const log of logs) {
      if (log.date_iso < startDate || log.date_iso > endDate) continue;
      const completedIds = log.completed_task_ids ?? [];
      const completedAll = completedIds.filter((taskId) => activeAllIds.has(taskId)).length;
      const completedLocked = completedIds.filter((taskId) => activeLockedIds.has(taskId)).length;
      if (!map[log.date_iso]) continue;
      map[log.date_iso].completedAll = completedAll;
      map[log.date_iso].completedLocked = completedLocked;
    }
    return map;
  }

  const [tasks, logs] = await Promise.all([
    db.body_program_tasks.where("program_id").equals(normalizedProgramId).toArray(),
    db.body_day_logs
      .where("program_id")
      .equals(normalizedProgramId)
      .and((row) => row.date_iso >= startDate && row.date_iso <= endDate)
      .toArray(),
  ]);
  const activeTasks = tasks.filter((task) => task.is_active && task.id);
  const activeAllIds = new Set(activeTasks.map((task) => String(task.id)));
  const activeLockedIds = new Set(
    activeTasks.filter((task) => task.locked).map((task) => String(task.id)),
  );

  for (const date of dates) {
    map[date].totalAll = activeAllIds.size;
    map[date].totalLocked = activeLockedIds.size;
  }

  for (const log of logs) {
    if (log.date_iso < startDate || log.date_iso > endDate) continue;
    const completedIds = log.completed_task_ids ?? [];
    const completedAll = completedIds.filter((taskId) => activeAllIds.has(taskId)).length;
    const completedLocked = completedIds.filter((taskId) => activeLockedIds.has(taskId)).length;
    if (!map[log.date_iso]) continue;
    map[log.date_iso].completedAll = completedAll;
    map[log.date_iso].completedLocked = completedLocked;
  }

  return map;
}
