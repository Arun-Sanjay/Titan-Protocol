import { db, type NutritionMeal, type NutritionProfile } from "./db";
import { uid } from "./id";

const DEFAULT_PROFILE_ID = "default";

export type NutritionWizardInput = {
  sex: "male" | "female";
  age: number;
  height_cm: number;
  weight_kg: number;
  bodyfat_pct: number | null;
  steps_per_day: number;
  workouts_per_week: number;
  goal: "cut" | "bulk" | "maintain";
  rate_kg_per_week: 0 | 0.25 | 0.5 | 0.75 | 1;
  protein_preference: "high" | "normal";
};

export type NutritionTargets = {
  bmr: number;
  activity_multiplier: number;
  tdee: number;
  calorie_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}

export function computeActivityMultiplier(stepsPerDay: number, workoutsPerWeek: number): number {
  let base = 1.2;
  if (stepsPerDay >= 12000) base = 1.65;
  else if (stepsPerDay >= 8000) base = 1.5;
  else if (stepsPerDay >= 5000) base = 1.35;

  let adjustment = 0;
  if (workoutsPerWeek >= 5) adjustment = 0.15;
  else if (workoutsPerWeek >= 3) adjustment = 0.1;
  else if (workoutsPerWeek >= 1) adjustment = 0.05;

  const multiplier = base + adjustment;
  return Math.min(1.9, Math.max(1.2, Number(multiplier.toFixed(2))));
}

export function computeNutritionTargets(input: NutritionWizardInput): NutritionTargets {
  const { sex, weight_kg, height_cm, age, goal, rate_kg_per_week, protein_preference } = input;
  const bmr =
    sex === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const activity_multiplier = computeActivityMultiplier(input.steps_per_day, input.workouts_per_week);
  const tdee = bmr * activity_multiplier;

  const adjustmentMap: Record<number, number> = {
    0.25: 250,
    0.5: 500,
    0.75: 750,
    1: 1000,
  };

  const adjustment = goal === "maintain" ? 0 : adjustmentMap[rate_kg_per_week] ?? 0;
  const calorie_target =
    goal === "cut" ? tdee - adjustment : goal === "bulk" ? tdee + adjustment : tdee;

  const proteinMultiplier = protein_preference === "high" ? 2.0 : 1.6;
  const protein_g = roundTo5(weight_kg * proteinMultiplier);
  const fat_g = roundTo5(weight_kg * 0.8);

  const caloriesFromProtein = protein_g * 4;
  const caloriesFromFat = fat_g * 9;
  const carbsCalories = Math.max(0, calorie_target - (caloriesFromProtein + caloriesFromFat));
  const carbs_g = roundTo5(carbsCalories / 4);

  return {
    bmr,
    activity_multiplier,
    tdee,
    calorie_target: Math.round(calorie_target),
    protein_g,
    carbs_g,
    fat_g,
  };
}

export async function upsertNutritionProfile(
  profile: Omit<NutritionProfile, "id" | "created_at" | "updated_at"> & { id?: string },
): Promise<NutritionProfile> {
  const id = profile.id ?? DEFAULT_PROFILE_ID;
  const existing = await db.nutrition_profiles.get(id);
  const now = new Date().toISOString();
  const nextProfile: NutritionProfile = {
    ...(existing ?? { id, created_at: now }),
    ...profile,
    id,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  await db.nutrition_profiles.put(nextProfile);
  return nextProfile;
}

export async function getNutritionProfile(id: string = DEFAULT_PROFILE_ID): Promise<NutritionProfile | undefined> {
  return db.nutrition_profiles.get(id);
}

export async function addMeal(
  meal: Omit<NutritionMeal, "id" | "created_at"> & { id?: string },
): Promise<NutritionMeal> {
  if (!db.nutrition_meals) {
    throw new Error("nutrition_meals table missing - check db.ts schema/version");
  }
  const id = meal.id ?? uid();
  const created_at = new Date().toISOString();
  const nextMeal: NutritionMeal = {
    ...meal,
    id,
    created_at,
    carbs_g: meal.carbs_g ?? null,
    fat_g: meal.fat_g ?? null,
  };
  await db.nutrition_meals.put(nextMeal);
  return nextMeal;
}

export async function listMealsByDate(dateISO: string): Promise<NutritionMeal[]> {
  return db.nutrition_meals.where("dateISO").equals(dateISO).toArray();
}

export async function deleteMeal(mealId: string): Promise<void> {
  await db.nutrition_meals.delete(mealId);
}

export async function updateMeal(
  mealId: string,
  patch: Partial<Omit<NutritionMeal, "id" | "created_at">>,
): Promise<void> {
  const nextPatch = {
    ...patch,
  } as Partial<NutritionMeal>;
  if (patch.carbs_g === undefined) {
    // leave untouched
  } else if (patch.carbs_g === null) {
    nextPatch.carbs_g = null;
  }
  if (patch.fat_g === undefined) {
    // leave untouched
  } else if (patch.fat_g === null) {
    nextPatch.fat_g = null;
  }
  await db.nutrition_meals.update(mealId, nextPatch);
}
