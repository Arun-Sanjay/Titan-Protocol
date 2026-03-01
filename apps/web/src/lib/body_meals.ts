import { db, type BodyMealRecord } from "./db";

function normalizeMacro(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

export async function addMeal(input: {
  date: string;
  name: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new Error("Meal name is required");
  if (!Number.isFinite(input.calories) || input.calories <= 0) {
    throw new Error("Calories are required");
  }

  return db.body_meals.add({
    date: input.date,
    name,
    calories: Math.round(input.calories),
    protein: normalizeMacro(input.protein),
    carbs: normalizeMacro(input.carbs),
    fat: normalizeMacro(input.fat),
    created_at: Date.now(),
  });
}

export async function updateMeal(
  id: number,
  patch: {
    name: string;
    calories: number;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  },
): Promise<void> {
  const name = patch.name.trim();
  if (!name) throw new Error("Meal name is required");
  if (!Number.isFinite(patch.calories) || patch.calories <= 0) {
    throw new Error("Calories are required");
  }

  await db.body_meals.update(id, {
    name,
    calories: Math.round(patch.calories),
    protein: normalizeMacro(patch.protein),
    carbs: normalizeMacro(patch.carbs),
    fat: normalizeMacro(patch.fat),
  });
}

export async function deleteMeal(id: number): Promise<void> {
  await db.body_meals.delete(id);
}

export async function listMealsByDate(date: string): Promise<BodyMealRecord[]> {
  return db.body_meals.where("date").equals(date).reverse().sortBy("created_at");
}

export async function computeTotals(date: string): Promise<{
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}> {
  const meals = await listMealsByDate(date);
  const calories = meals.reduce((sum, meal) => sum + meal.calories, 0);

  const proteinValues = meals.map((meal) => meal.protein).filter((value): value is number => value !== null);
  const carbsValues = meals.map((meal) => meal.carbs).filter((value): value is number => value !== null);
  const fatValues = meals.map((meal) => meal.fat).filter((value): value is number => value !== null);

  const protein = proteinValues.length > 0 ? proteinValues.reduce((sum, value) => sum + value, 0) : null;
  const carbs = carbsValues.length > 0 ? carbsValues.reduce((sum, value) => sum + value, 0) : null;
  const fat = fatValues.length > 0 ? fatValues.reduce((sum, value) => sum + value, 0) : null;

  return {
    calories,
    protein: protein === null ? null : Math.round(protein),
    carbs: carbs === null ? null : Math.round(carbs),
    fat: fat === null ? null : Math.round(fat),
  };
}
