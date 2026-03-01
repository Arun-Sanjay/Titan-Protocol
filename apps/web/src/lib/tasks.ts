import {
  db,
  type OSNutritionLogRecord,
  type OSProgramTaskRecord,
  type OSTaskLogRecord,
} from "./db";

function nowIso(): string {
  return new Date().toISOString();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampMacro(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.round(value));
}

export async function listProgramTasks(programId: number): Promise<OSProgramTaskRecord[]> {
  const rows = await db.os_program_tasks.where("programId").equals(programId).toArray();
  return rows.sort((first, second) => {
    if (first.isLocked !== second.isLocked) return first.isLocked ? -1 : 1;
    if (first.isActive !== second.isActive) return first.isActive ? -1 : 1;
    return first.createdAt.localeCompare(second.createdAt);
  });
}

export async function addTask(
  programId: number,
  title: string,
  kind: string,
  isLocked = false,
  meta: Record<string, unknown> = {},
): Promise<OSProgramTaskRecord> {
  const cleanedTitle = title.trim();
  if (!cleanedTitle) throw new Error("Task title is required");

  const timestamp = nowIso();
  const id = await db.os_program_tasks.add({
    programId,
    title: cleanedTitle,
    kind,
    isLocked,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    meta,
  });
  const created = await db.os_program_tasks.get(id);
  if (!created) throw new Error("Failed to create task");
  return created;
}

export async function toggleTaskActive(taskId: number, isActive: boolean): Promise<OSProgramTaskRecord> {
  const task = await db.os_program_tasks.get(taskId);
  if (!task) throw new Error("Task not found");
  if (task.isLocked && !isActive) {
    throw new Error("LOCKED_TASK_CANNOT_BE_DISABLED");
  }
  await db.os_program_tasks.update(taskId, {
    isActive,
    updatedAt: nowIso(),
  });
  const updated = await db.os_program_tasks.get(taskId);
  if (!updated) throw new Error("Task not found");
  return updated;
}

export async function toggleTaskComplete(
  programId: number,
  taskId: number,
  date: string,
  completed: boolean,
): Promise<OSTaskLogRecord> {
  if (!isIsoDate(date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const task = await db.os_program_tasks.get(taskId);
  if (!task || task.programId !== programId || !task.isActive) {
    throw new Error("Task not found");
  }

  const existing = await db.os_task_logs.where("[programId+taskId+date]").equals([programId, taskId, date]).first();
  const payload: Omit<OSTaskLogRecord, "id"> = {
    programId,
    taskId,
    date,
    completed,
    completedAt: completed ? nowIso() : null,
  };

  if (existing?.id) {
    await db.os_task_logs.update(existing.id, payload);
    const updated = await db.os_task_logs.get(existing.id);
    if (!updated) throw new Error("Failed to update task log");
    return updated;
  }

  const id = await db.os_task_logs.add(payload);
  const created = await db.os_task_logs.get(id);
  if (!created) throw new Error("Failed to create task log");
  return created;
}

export async function getDayTaskStats(
  programId: number,
  date: string,
): Promise<{ completed: number; total: number; pct: number }> {
  if (!isIsoDate(date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const [tasks, logs] = await Promise.all([
    listProgramTasks(programId),
    db.os_task_logs.where("[programId+date]").equals([programId, date]).toArray(),
  ]);
  const activeTaskIds = new Set(tasks.filter((task) => task.isActive).map((task) => task.id as number));
  const total = activeTaskIds.size;
  if (total === 0) return { completed: 0, total: 0, pct: 0 };
  const completed = logs.filter((log) => log.completed && activeTaskIds.has(log.taskId)).length;
  return {
    completed,
    total,
    pct: Math.round((completed / total) * 100),
  };
}

export async function getTaskLogMapForRange(
  programId: number,
  startDate: string,
  endDate: string,
): Promise<Map<string, OSTaskLogRecord[]>> {
  const rows = await db.os_task_logs.where("programId").equals(programId).toArray();
  const map = new Map<string, OSTaskLogRecord[]>();
  for (const row of rows) {
    if (row.date < startDate || row.date > endDate) continue;
    const bucket = map.get(row.date) ?? [];
    bucket.push(row);
    map.set(row.date, bucket);
  }
  return map;
}

export async function getTaskCompletionMapForDate(
  programId: number,
  date: string,
): Promise<Map<number, boolean>> {
  if (!isIsoDate(date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const rows = await db.os_task_logs.where("[programId+date]").equals([programId, date]).toArray();
  const map = new Map<number, boolean>();
  for (const row of rows) {
    map.set(row.taskId, row.completed);
  }
  return map;
}

export async function addNutritionLog(input: {
  programId: number;
  date: string;
  mealName: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): Promise<OSNutritionLogRecord> {
  if (!isIsoDate(input.date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const name = input.mealName.trim();
  if (!name) throw new Error("Meal name is required");
  const calories = Math.max(0, Math.round(input.calories || 0));
  if (!calories) throw new Error("Calories are required");

  const id = await db.os_nutrition_logs.add({
    programId: input.programId,
    date: input.date,
    mealName: name,
    calories,
    protein: clampMacro(input.protein),
    carbs: clampMacro(input.carbs),
    fat: clampMacro(input.fat),
  });
  const created = await db.os_nutrition_logs.get(id);
  if (!created) throw new Error("Failed to create nutrition log");
  return created;
}

export async function getNutritionLogsForDate(
  programId: number,
  date: string,
): Promise<OSNutritionLogRecord[]> {
  if (!isIsoDate(date)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const rows = await db.os_nutrition_logs.where("[programId+date]").equals([programId, date]).toArray();
  return rows.sort((first, second) => (first.id ?? 0) - (second.id ?? 0));
}

export async function getNutritionTotalsForDate(
  programId: number,
  date: string,
): Promise<{
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}> {
  const logs = await getNutritionLogsForDate(programId, date);
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let proteinCount = 0;
  let carbsCount = 0;
  let fatCount = 0;

  for (const row of logs) {
    calories += row.calories;
    if (typeof row.protein === "number") {
      protein += row.protein;
      proteinCount += 1;
    }
    if (typeof row.carbs === "number") {
      carbs += row.carbs;
      carbsCount += 1;
    }
    if (typeof row.fat === "number") {
      fat += row.fat;
      fatCount += 1;
    }
  }

  return {
    calories,
    protein: proteinCount > 0 ? protein : null,
    carbs: carbsCount > 0 ? carbs : null,
    fat: fatCount > 0 ? fat : null,
  };
}
