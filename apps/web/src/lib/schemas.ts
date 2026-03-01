import { z } from "zod";

const bodyProfileTracks = ["gym_strength", "boxing", "running", "sport", "mobility"] as const;
const rateKgPerWeekSchema = z.union([z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1.0)]);

export const bodyProfileSchema = z.object({
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
  createdAt: z.string().datetime().optional().default(() => new Date().toISOString()),
  height_cm: z.number().min(50).max(260),
  weight_kg: z.number().min(20).max(400),
  age: z.number().int().min(10).max(110),
  sex: z.enum(["male", "female", "other"]),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal_type: z.enum(["fat_loss", "muscle_gain", "recomposition", "performance", "discipline"]),
  goal_direction: z.enum(["cut", "bulk", "maintain"]).optional().default("maintain"),
  rate_kg_per_week: rateKgPerWeekSchema.optional().default(0.5),
  daily_calorie_delta: z.number().int().optional().default(0),
  goal_weight_kg: z.number().min(20).max(400).nullable(),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  tracks: z.array(z.enum(bodyProfileTracks)),
  track_config: z.partialRecord(
    z.enum(bodyProfileTracks),
    z.object({
      days_per_week: z.number().int().min(1).max(7),
      session_minutes: z.number().int().min(1).max(360),
    }),
  ),
  diet_type: z.enum(["non_veg", "veg", "vegan"]),
  allergies: z.array(z.string()),
  meals_per_day: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  tracking_mode: z.enum(["strict_macros", "calories_only", "hand_portions"]),
  sleep_hours_avg: z.number().min(0).max(24),
  sleep_window: z.object({
    bedtime: z.string().min(1),
    wake: z.string().min(1),
  }),
  stress_level: z.enum(["low", "medium", "high"]),
  injuries: z.array(z.string()),
  discipline_mode: z.enum(["strict", "flexible"]),
});

export const bodyProgramSchema = z.object({
  profile_id: z.number().int().positive(),
  goal_type: z.enum(["cut", "bulk", "recomposition", "performance"]),
  goal_direction: z.enum(["cut", "bulk", "maintain"]).optional().default("maintain"),
  rate_kg_per_week: rateKgPerWeekSchema.optional().default(0.5),
  daily_calorie_delta: z.number().int().optional().default(0),
  sleep_by: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().default("23:00"),
  wake_by: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().default("07:00"),
  createdAt: z.string().datetime().optional().default(() => new Date().toISOString()),
  title: z.string().min(1),
  duration_days: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_active: z.boolean(),
  is_locked: z.boolean(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
  archived_at: z.number().int().nonnegative().nullable(),
});

export const bodyCycleSchema = z.object({
  program_id: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_days: z.number().int().positive(),
  is_active: z.boolean(),
  completed: z.boolean(),
  created_at: z.number().int().nonnegative(),
});

export const programTaskSchema = z.object({
  program_id: z.number().int().positive(),
  title: z.string().min(1),
  category: z.enum(["sleep", "training", "nutrition", "recovery", "general"]),
  is_locked: z.boolean(),
  is_active: z.boolean(),
  frequency_type: z.enum(["daily", "weekly"]),
  target_value: z.number().min(0).nullable(),
  unit: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),

  module: z.enum(["nutrition", "gym", "boxing", "recovery", "sleep", "general"]),
  description: z.string(),
  frequency: z.enum(["daily", "weekly", "x_per_week"]),
  target: z.string().nullable(),
});

export const nutritionMealSchema = z.object({
  program_id: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calories: z.number().int().min(0).max(10000),
  protein_g: z.number().int().min(0).max(1000),
  fat_g: z.number().int().min(0).max(1000),
  carbs_g: z.number().int().min(0).max(1000),
  notes: z.string().max(4000).optional(),
});

export const bodyTaskSchema = z.object({
  programId: z.number().int().positive(),
  title: z.string().min(1),
  category: z.enum(["sleep", "training", "nutrition", "recovery", "custom"]),
  isNonNegotiable: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export function validateBodyProfile(data: unknown) {
  return bodyProfileSchema.parse(data);
}

export function validateBodyProgram(data: unknown) {
  return bodyProgramSchema.parse(data);
}

export function validateBodyCycle(data: unknown) {
  return bodyCycleSchema.parse(data);
}

export function validateProgramTask(data: unknown) {
  return programTaskSchema.parse(data);
}

export function validateNutritionMeal(data: unknown) {
  return nutritionMealSchema.parse(data);
}

export function validateBodyTask(data: unknown) {
  return bodyTaskSchema.parse(data);
}
