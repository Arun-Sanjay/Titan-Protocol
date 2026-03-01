import type { BodyProfileActivityLevel, BodyProfileRecord } from "./db";

type BodyMathProfile = Pick<
  BodyProfileRecord,
  "sex" | "weight_kg" | "height_cm" | "age" | "activity_level" | "goal_type" | "experience" | "sleep_hours_avg" | "stress_level"
>;

function round(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mifflinStJeorBMR(input: {
  sex: BodyProfileRecord["sex"];
  weight_kg: number;
  height_cm: number;
  age: number;
}): number {
  const base = 10 * input.weight_kg + 6.25 * input.height_cm - 5 * input.age;
  const sexAdjust = input.sex === "male" ? 5 : input.sex === "female" ? -161 : -78;
  return round(base + sexAdjust);
}

export function activityMultiplier(activity_level: BodyProfileActivityLevel): number {
  const mapping: Record<BodyProfileActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return mapping[activity_level];
}

export function estimateTDEE(profile: BodyMathProfile): number {
  const bmr = mifflinStJeorBMR({
    sex: profile.sex,
    weight_kg: profile.weight_kg,
    height_cm: profile.height_cm,
    age: profile.age,
  });
  return round(bmr * activityMultiplier(profile.activity_level));
}

export function calorieTarget(profile: BodyMathProfile, duration_days: number): number {
  const tdee = estimateTDEE(profile);
  const duration = clamp(duration_days || 90, 30, 90);

  let adjustment = 0;
  if (profile.goal_type === "fat_loss") {
    adjustment = duration <= 30 ? -0.25 : duration <= 60 ? -0.2 : -0.15;
    if (profile.stress_level === "high") adjustment += 0.05;
    if (profile.stress_level === "medium") adjustment += 0.02;
    adjustment = clamp(adjustment, -0.25, -0.1);
  } else if (profile.goal_type === "muscle_gain") {
    adjustment = duration <= 30 ? 0.12 : duration <= 60 ? 0.09 : 0.07;
    if (profile.stress_level === "high") adjustment -= 0.02;
    adjustment = clamp(adjustment, 0.05, 0.12);
  } else if (profile.goal_type === "recomposition") {
    adjustment = duration <= 30 ? -0.1 : duration <= 60 ? -0.07 : -0.05;
    if (profile.stress_level === "high") adjustment += 0.03;
    adjustment = clamp(adjustment, -0.1, 0);
  } else if (profile.goal_type === "performance" || profile.goal_type === "discipline") {
    adjustment = 0;
  }

  return round(tdee * (1 + adjustment));
}

export function macroTargets(profile: BodyMathProfile, calories: number): {
  protein_g: number;
  fat_g: number;
  carbs_g: number;
} {
  let proteinPerKg = 1.8;
  if (profile.goal_type === "fat_loss") proteinPerKg = 2;
  if (profile.goal_type === "muscle_gain") {
    proteinPerKg =
      profile.experience === "advanced"
        ? 2.2
        : profile.experience === "intermediate"
          ? 2
          : 1.8;
  }
  if (profile.goal_type === "recomposition") proteinPerKg = 2.2;
  if (profile.goal_type === "performance") proteinPerKg = profile.activity_level === "very_active" ? 2 : 1.6;

  const protein_g = round(profile.weight_kg * proteinPerKg);
  const fatMinPerKg = profile.stress_level === "high" || profile.sleep_hours_avg < 7 ? 0.8 : 0.7;
  const fat_g = round(profile.weight_kg * fatMinPerKg);

  const remainingCalories = calories - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, round(remainingCalories / 4));

  return { protein_g, fat_g, carbs_g };
}

export function stepsTarget(profile: Pick<BodyMathProfile, "goal_type" | "activity_level">): number {
  const fatLossMap: Record<BodyProfileActivityLevel, number> = {
    sedentary: 8000,
    light: 9000,
    moderate: 10000,
    active: 11000,
    very_active: 12000,
  };
  const standardMap: Record<BodyProfileActivityLevel, number> = {
    sedentary: 6000,
    light: 7000,
    moderate: 8000,
    active: 9000,
    very_active: 10000,
  };
  return profile.goal_type === "fat_loss"
    ? fatLossMap[profile.activity_level]
    : standardMap[profile.activity_level];
}

export function sleepTarget(profile: Pick<BodyMathProfile, "sleep_hours_avg">): number {
  if (profile.sleep_hours_avg < 6) return 6.5;
  if (profile.sleep_hours_avg < 7) return 7.0;
  return 7.5;
}

export function computeBodyTargets(
  profile: BodyMathProfile,
  duration_days: number,
): {
  tdee: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  steps: number;
  sleep_hours_target: number;
} {
  const tdee = estimateTDEE(profile);
  const calories = calorieTarget(profile, duration_days);
  const macros = macroTargets(profile, calories);

  return {
    tdee,
    calories,
    protein_g: macros.protein_g,
    fat_g: macros.fat_g,
    carbs_g: macros.carbs_g,
    steps: stepsTarget(profile),
    sleep_hours_target: sleepTarget(profile),
  };
}
