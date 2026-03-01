import { db, type BodyTaskCompletionRecord, type ProgramTaskLogRecord } from "./db";
import {
  computeConsistency,
  computeDayCompletionPercent,
  getActiveBodyCycle,
  getDayLog,
  getRangeDayLogs,
  listProgramTasks,
  toggleTaskForDate,
} from "./body_program";

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

function dayDiffInclusive(start: string, end: string): number {
  const startMs = parseDateOnly(start).getTime();
  const endMs = parseDateOnly(end).getTime();
  if (endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}

function eachDate(start: string, end: string): string[] {
  if (end < start) return [];
  const [startYear, startMonth, startDay] = start.split("-").map((part) => Number.parseInt(part, 10));
  const [endYear, endMonth, endDay] = end.split("-").map((part) => Number.parseInt(part, 10));
  const cursor = new Date(startYear, (startMonth || 1) - 1, startDay || 1);
  const endDate = new Date(endYear, (endMonth || 1) - 1, endDay || 1);
  const values: string[] = [];
  while (cursor <= endDate) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    values.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

async function resolveProgramIdForTask(taskId: number): Promise<number> {
  const task = await db.body_program_tasks.get(taskId);
  if (task?.program_id) return task.program_id;
  throw new Error("Task not found");
}

async function getActiveTaskIds(programId: number): Promise<number[]> {
  const tasks = await listProgramTasks(programId);
  return tasks
    .filter((task) => task.is_active && typeof task.id === "number")
    .map((task) => task.id as number);
}

async function setTaskCompletionForDate(
  program_id: number,
  task_id: number,
  date_iso: string,
  completed: boolean,
): Promise<void> {
  const existing = await getDayLog(program_id, date_iso);
  const now = Date.now();
  const key = String(task_id);
  const completedTaskIds = new Set(existing?.completed_task_ids ?? []);
  if (completed) {
    completedTaskIds.add(key);
  } else {
    completedTaskIds.delete(key);
  }
  const payload = [...completedTaskIds];

  if (existing?.id) {
    await db.body_day_logs.update(existing.id, {
      completed_task_ids: payload,
      updated_at: now,
    });
    return;
  }

  await db.body_day_logs.add({
    program_id,
    date_iso,
    completed_task_ids: payload,
    notes: null,
    created_at: now,
    updated_at: now,
  });
}

export type ConsistencyDay = {
  date: string;
  percentComplete: number;
  doneCount: number;
  totalCount: number;
};

export async function calculateDailyConsistency(programId: number, date: string): Promise<number> {
  if (!isIsoDate(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const [tasks, dayLog] = await Promise.all([
    listProgramTasks(programId),
    getDayLog(programId, date),
  ]);
  return computeDayCompletionPercent(tasks, dayLog?.completed_task_ids ?? []);
}

export async function toggleTaskCompletion(
  taskId: number,
  date: string,
): Promise<BodyTaskCompletionRecord> {
  if (!isIsoDate(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  const programId = await resolveProgramIdForTask(taskId);
  const updated = await toggleTaskForDate(programId, date, taskId);
  const completed = updated.completed_task_ids.includes(String(taskId));
  return {
    programId,
    taskId,
    date,
    completed,
    completedAt: completed ? new Date().toISOString() : null,
  };
}

export async function getCompletionsForDate(
  programId: number,
  date: string,
): Promise<BodyTaskCompletionRecord[]> {
  if (!isIsoDate(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const [tasks, dayLog] = await Promise.all([
    listProgramTasks(programId),
    getDayLog(programId, date),
  ]);
  const completedSet = new Set(dayLog?.completed_task_ids ?? []);
  return tasks
    .filter((task) => task.is_active && typeof task.id === "number")
    .map((task) => ({
      programId,
      taskId: task.id as number,
      date,
      completed: completedSet.has(String(task.id)),
      completedAt: completedSet.has(String(task.id)) ? new Date().toISOString() : null,
    }));
}

export async function getTodayCompletionSummary(programId: number, date: string): Promise<{
  nonNegotiables: { done: number; total: number };
  allActive: { done: number; total: number };
  todayConsistency: number;
}> {
  if (!isIsoDate(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const [tasks, dayLog] = await Promise.all([
    listProgramTasks(programId),
    getDayLog(programId, date),
  ]);

  const activeTasks = tasks.filter((task) => task.is_active && typeof task.id === "number");
  const lockedTasks = activeTasks.filter((task) => task.locked);
  const completedSet = new Set(dayLog?.completed_task_ids ?? []);

  const doneCount = activeTasks.filter((task) => completedSet.has(String(task.id))).length;
  const nonNegDoneCount = lockedTasks.filter((task) => completedSet.has(String(task.id))).length;

  return {
    nonNegotiables: { done: nonNegDoneCount, total: lockedTasks.length },
    allActive: { done: doneCount, total: activeTasks.length },
    todayConsistency: activeTasks.length > 0 ? Math.round((doneCount / activeTasks.length) * 100) : 0,
  };
}

export async function getConsistencyForRange(
  programId: number,
  startDate: string,
  endDate: string,
): Promise<ConsistencyDay[]> {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (endDate < startDate) {
    return [];
  }

  const [tasks, logs] = await Promise.all([
    listProgramTasks(programId),
    getRangeDayLogs(programId, startDate, endDate),
  ]);
  const activeTaskIds = tasks
    .filter((task) => task.is_active && typeof task.id === "number")
    .map((task) => String(task.id));
  const totalCount = activeTaskIds.length;
  const activeTaskSet = new Set(activeTaskIds);
  const byDate = new Map(logs.map((log) => [log.date_iso, log.completed_task_ids] as const));

  return eachDate(startDate, endDate).map((date) => {
    const completedIds = byDate.get(date) ?? [];
    const doneCount = completedIds.filter((id) => activeTaskSet.has(id)).length;
    const percentComplete = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
    return { date, percentComplete, doneCount, totalCount };
  });
}

export async function logProgramTaskToday(
  program_id: number,
  task_id: number,
  completed: boolean,
  value?: string | null,
  dateInput?: string,
): Promise<ProgramTaskLogRecord> {
  const cycle = await getActiveBodyCycle(program_id);
  if (!cycle) {
    throw new Error("No active cycle for this program.");
  }

  const date = dateInput ?? todayDateString();
  if (!isIsoDate(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  if (date < cycle.start_date || date > cycle.end_date) {
    throw new Error("Selected date is outside the active cycle window.");
  }

  await setTaskCompletionForDate(program_id, task_id, date, completed);
  return {
    program_id,
    task_id,
    date,
    completed,
    value: value ?? null,
  };
}

export async function getTodayTaskLogs(program_id: number, date?: string): Promise<BodyTaskCompletionRecord[]> {
  return getCompletionsForDate(program_id, date ?? todayDateString());
}

export async function getProgramConsistency(program_id: number): Promise<{
  consistency: number;
  dayIndex: number;
  totalDays: number;
  elapsedDays: number;
}> {
  const cycle = await getActiveBodyCycle(program_id);
  if (!cycle) {
    return { consistency: 0, dayIndex: 0, totalDays: 0, elapsedDays: 0 };
  }

  const today = todayDateString();
  const windowEnd = today < cycle.end_date ? today : cycle.end_date;
  const elapsedDays = dayDiffInclusive(cycle.start_date, windowEnd);
  if (elapsedDays <= 0) {
    return { consistency: 0, dayIndex: 0, totalDays: cycle.duration_days, elapsedDays: 0 };
  }

  const [tasks, logs] = await Promise.all([
    listProgramTasks(program_id),
    getRangeDayLogs(program_id, cycle.start_date, windowEnd),
  ]);
  const consistency = computeConsistency(tasks, logs, cycle.start_date, windowEnd);

  return {
    consistency,
    dayIndex: elapsedDays,
    totalDays: cycle.duration_days,
    elapsedDays,
  };
}

export async function autoEvaluateGymTasks(program_id: number, date: string): Promise<void> {
  if (!isIsoDate(date)) return;
  const workoutExists = await db.workouts
    .filter((workout) => typeof workout.finished_at === "number" && workout.date === date)
    .count();
  if (workoutExists === 0) return;

  const tasks = await listProgramTasks(program_id);
  const gymTaskIds = tasks
    .filter((task) => {
      if (!task.is_active || typeof task.id !== "number") return false;
      const title = task.title.toLowerCase();
      return task.kind === "training" || title.includes("gym") || title.includes("strength");
    })
    .map((task) => task.id as number);

  for (const taskId of gymTaskIds) {
    await setTaskCompletionForDate(program_id, taskId, date, true);
  }
}
