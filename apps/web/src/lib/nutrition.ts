import { db, type MealLogRecord, type MealRecord, type NutritionLogRecord } from "./db";
import { validateNutritionMeal } from "./schemas";
import { getDayLog, listProgramTasks } from "./body_program";

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

function dateToString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBack(count: number): string[] {
  const dates: string[] = [];
  const today = parseDateOnly(todayDateString()).getTime();
  for (let index = count - 1; index >= 0; index -= 1) {
    dates.push(dateToString(new Date(today - index * 24 * 60 * 60 * 1000)));
  }
  return dates;
}

function isCaloriesHit(
  mode: "strict_macros" | "calories_only",
  actual: number,
  target: number,
): boolean {
  const tolerance = mode === "strict_macros" ? 0.05 : 0.08;
  return Math.abs(actual - target) <= target * tolerance;
}

function isProteinHit(actual: number, target: number): boolean {
  return actual >= target * 0.95;
}

function normalizeOptionalMacro(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.round(value));
}

export async function createMealTemplate(input: {
  name: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): Promise<MealRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Meal name is required");

  const payload: Omit<MealRecord, "id"> = {
    name,
    calories: Math.max(0, Math.round(input.calories || 0)),
    protein: normalizeOptionalMacro(input.protein),
    carbs: normalizeOptionalMacro(input.carbs),
    fat: normalizeOptionalMacro(input.fat),
  };

  const id = await db.meals.add(payload);
  const created = await db.meals.get(id);
  if (!created) throw new Error("Failed to create meal template");
  return created;
}

export async function listMealTemplates(): Promise<MealRecord[]> {
  return db.meals.orderBy("name").toArray();
}

export async function logMealForDate(input: {
  date: string;
  time?: string;
  mealId?: number | null;
  nameSnapshot?: string;
  caloriesSnapshot?: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): Promise<MealLogRecord> {
  const date = input.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const template = typeof input.mealId === "number" ? await db.meals.get(input.mealId) : null;
  if (typeof input.mealId === "number" && !template) {
    throw new Error("Meal template not found");
  }

  const name = (input.nameSnapshot ?? template?.name ?? "").trim();
  if (!name) {
    throw new Error("Meal name is required");
  }

  const caloriesValue = input.caloriesSnapshot ?? template?.calories;
  if (typeof caloriesValue !== "number" || Number.isNaN(caloriesValue)) {
    throw new Error("Calories are required");
  }

  const payload: Omit<MealLogRecord, "id"> = {
    date,
    time: input.time ?? new Date().toISOString(),
    mealId: template?.id ?? null,
    nameSnapshot: name,
    caloriesSnapshot: Math.max(0, Math.round(caloriesValue)),
    protein: normalizeOptionalMacro(input.protein ?? template?.protein ?? null),
    carbs: normalizeOptionalMacro(input.carbs ?? template?.carbs ?? null),
    fat: normalizeOptionalMacro(input.fat ?? template?.fat ?? null),
  };

  const id = await db.meal_logs.add(payload);
  const created = await db.meal_logs.get(id);
  if (!created) throw new Error("Failed to log meal");
  return created;
}

export async function getMealsForDate(date: string): Promise<MealLogRecord[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  const entries = await db.meal_logs.where("date").equals(date).toArray();
  return entries.sort((a, b) => (a.time < b.time ? 1 : -1));
}

export async function getTotalsForDate(date: string): Promise<{
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}> {
  const logs = await getMealsForDate(date);
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let proteinCount = 0;
  let carbsCount = 0;
  let fatCount = 0;

  for (const log of logs) {
    calories += Math.max(0, Math.round(log.caloriesSnapshot || 0));
    if (typeof log.protein === "number") {
      protein += log.protein;
      proteinCount += 1;
    }
    if (typeof log.carbs === "number") {
      carbs += log.carbs;
      carbsCount += 1;
    }
    if (typeof log.fat === "number") {
      fat += log.fat;
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

export async function getCurrentNutritionTarget(program_id: number) {
  const targets = await db.nutrition_targets.where("program_id").equals(program_id).toArray();
  return targets.sort((first, second) => (second.created_at || 0) - (first.created_at || 0))[0] ?? null;
}

export async function getTodayNutritionLog(program_id: number): Promise<NutritionLogRecord | null> {
  const log = await db.nutrition_logs.where("[program_id+date]").equals([program_id, todayDateString()]).first();
  return log ?? null;
}

export async function upsertNutritionLog(input: {
  program_id: number;
  date?: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  notes?: string;
}): Promise<NutritionLogRecord> {
  const program = await db.body_programs.get(input.program_id);
  if (!program) throw new Error("Program not found");

  const date = input.date ?? todayDateString();
  const payload: Omit<NutritionLogRecord, "id"> = validateNutritionMeal({
    program_id: input.program_id,
    date,
    calories: Math.max(0, Math.round(input.calories || 0)),
    protein_g: Math.max(0, Math.round(input.protein_g || 0)),
    fat_g: Math.max(0, Math.round(input.fat_g || 0)),
    carbs_g: Math.max(0, Math.round(input.carbs_g || 0)),
    notes: input.notes?.trim() || undefined,
  });

  const existing = await db.nutrition_logs.where("[program_id+date]").equals([input.program_id, date]).first();
  if (existing?.id) {
    await db.nutrition_logs.update(existing.id, payload);
    const updated = await db.nutrition_logs.get(existing.id);
    if (!updated) throw new Error("Failed to update nutrition log");
    return updated;
  }

  const id = await db.nutrition_logs.add(payload);
  const created = await db.nutrition_logs.get(id);
  if (!created) throw new Error("Failed to save nutrition log");
  return created;
}

export async function getWeeklyNutritionSummary(program_id: number): Promise<{
  daysHitProteinTarget: number;
  daysHitCaloriesTarget: number;
  trackedDays: number;
}> {
  const [target, program, allLogs] = await Promise.all([
    getCurrentNutritionTarget(program_id),
    db.body_programs.get(program_id),
    db.nutrition_logs.where("program_id").equals(program_id).toArray(),
  ]);
  if (!target || !program) {
    return { daysHitProteinTarget: 0, daysHitCaloriesTarget: 0, trackedDays: 0 };
  }

  if (program.profile_id) {
    const profile = await db.body_profiles.get(program.profile_id);
    if (!profile) {
      return { daysHitProteinTarget: 0, daysHitCaloriesTarget: 0, trackedDays: 0 };
    }
    const mode = profile.tracking_mode;
    if (mode !== "strict_macros" && mode !== "calories_only") {
      return { daysHitProteinTarget: 0, daysHitCaloriesTarget: 0, trackedDays: 0 };
    }

    const dateSet = new Set(daysBack(7));
    const logs = allLogs.filter((log) => dateSet.has(log.date));

    return {
      trackedDays: logs.length,
      daysHitCaloriesTarget: logs.filter((log) =>
        isCaloriesHit(mode, log.calories, target.calories),
      ).length,
      daysHitProteinTarget: logs.filter((log) => isProteinHit(log.protein_g, target.protein_g)).length,
    };
  }

  return { daysHitProteinTarget: 0, daysHitCaloriesTarget: 0, trackedDays: 0 };
}

export async function autoEvaluateNutritionTasks(program_id: number, date: string) {
  const [program, nutritionTarget, nutritionLog] = await Promise.all([
    db.body_programs.get(program_id),
    getCurrentNutritionTarget(program_id),
    db.nutrition_logs.where("[program_id+date]").equals([program_id, date]).first(),
  ]);
  if (!program || !nutritionTarget || !nutritionLog) return;

  const profile = await db.body_profiles.get(program.profile_id);
  if (!profile) return;
  const mode = profile.tracking_mode;
  if (mode !== "strict_macros" && mode !== "calories_only") return;

  const caloriesHit = isCaloriesHit(mode, nutritionLog.calories, nutritionTarget.calories);
  const proteinHit = isProteinHit(nutritionLog.protein_g, nutritionTarget.protein_g);

  const nutritionTasks = (await listProgramTasks(program_id)).filter(
    (task) => task.is_active && task.locked && task.kind === "nutrition" && typeof task.id === "number",
  );

  if (nutritionTasks.length === 0) return;

  const existingDayLog = await getDayLog(program_id, date);
  const completedTaskIds = new Set(existingDayLog?.completed_task_ids ?? []);
  for (const task of nutritionTasks) {
    const taskId = task.id as number;
    const title = task.title.toLowerCase();
    const needsCalories = title.includes("calorie") || title.includes("kcal");
    const needsProtein = title.includes("protein");
    if (!needsCalories && !needsProtein) continue;

    const completed = (needsCalories ? caloriesHit : true) && (needsProtein ? proteinHit : true);
    if (completed) {
      completedTaskIds.add(String(taskId));
    } else {
      completedTaskIds.delete(String(taskId));
    }
  }

  const now = Date.now();
  if (existingDayLog?.id) {
    await db.body_day_logs.update(existingDayLog.id, {
      completed_task_ids: [...completedTaskIds],
      updated_at: now,
    });
  } else {
    await db.body_day_logs.add({
      program_id,
      date_iso: date,
      completed_task_ids: [...completedTaskIds],
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }
}
