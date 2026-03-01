import Dexie, { type Table } from "dexie";

export type EngineName = "body" | "mind" | "money" | "general";
export type FocusMode = "pomodoro" | "short_break" | "long_break";
export type SkillSessionMode = "timer" | "manual";
export type BodyProfileSex = "male" | "female" | "other";
export type BodyProfileActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type BodyProfileGoalType =
  | "fat_loss"
  | "muscle_gain"
  | "recomposition"
  | "performance"
  | "discipline";
export type BodyProfileExperience = "beginner" | "intermediate" | "advanced";
export type BodyProfileTrack = "gym_strength" | "boxing" | "running" | "sport" | "mobility";
export type BodyProfileDietType = "non_veg" | "veg" | "vegan";
export type BodyProfileMealsPerDay = 2 | 3 | 4 | 5;
export type BodyProfileTrackingMode = "strict_macros" | "calories_only" | "hand_portions";
export type BodyProfileStressLevel = "low" | "medium" | "high";
export type BodyProfileDisciplineMode = "strict" | "flexible";
export type BodyProgramGoalType = "cut" | "bulk" | "recomposition" | "performance";
export type GoalDirection = "cut" | "bulk" | "maintain";
export type RateKgPerWeek = 0.25 | 0.5 | 0.75 | 1.0;
export type ProgramTaskCategory = "sleep" | "training" | "nutrition" | "recovery" | "general";
export type ProgramTaskModule = "nutrition" | "gym" | "boxing" | "recovery" | "sleep" | "general";
export type ProgramTaskFrequency = "daily" | "weekly" | "x_per_week";
export type ProgramTaskFrequencyType = "daily" | "weekly";
export type BodyTaskCategory = "sleep" | "training" | "nutrition" | "recovery" | "custom";
export type BodyTaskKind = "habit" | "nutrition" | "training";
export type MindIssue = "overthinking" | "anxiety" | "low_focus" | "dopamine";
export type MindTaskCategory = "deep_work" | "discipline" | "journaling" | "reset";
export type MindRuleType =
  | "social_cutoff"
  | "night_shutdown"
  | "no_short_form"
  | "phone_away_deepwork";
export type MindInterruptionReason =
  | "phone"
  | "thought_spiral"
  | "notification"
  | "people"
  | "craving"
  | "other";

export interface MindMorningJournal {
  q1: string;
  q2: string;
  q3: string;
}

export interface MindEveningJournal {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export interface BodyProfileTrackConfig {
  days_per_week: number;
  session_minutes: number;
}

export interface BodyProfileSleepWindow {
  bedtime: string;
  wake: string;
}

export interface EngineRecord {
  id?: number;
  name: EngineName;
  is_active: boolean;
  created_at: number;
}

export interface ModuleRecord {
  id?: number;
  engine_id: number;
  name: string;
  is_core: boolean;
  is_active: boolean;
}

export interface CycleRecord {
  id?: number;
  engine_id: number;
  module_id?: number | null;
  title: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_primary: boolean;
  is_archived?: boolean;
  archived_at?: string | null;
  total_completed_days: number;
}

export interface DailyLogRecord {
  id?: number;
  cycle_id?: number;
  module_id?: number;
  engine_id?: number;
  date: string;
  completed?: boolean;
  value?: number;
  completed_task_ids?: number[];
}

export interface EngineTaskRecord {
  id?: number;
  engine_id: number;
  title: string;
  is_non_negotiable: boolean;
  is_active: boolean;
  created_at: number;
  archived_at?: number | null;
}

export interface FocusSessionRecord {
  id?: number;
  engine_id: number;
  cycle_id?: number | null;
  started_at: number;
  ended_at: number;
  duration_min: number;
  mode: FocusMode;
  completed: boolean;
}

export interface WorkoutRecord {
  id?: number;
  engine_id: number;
  cycle_id?: number | null;
  date: string;
  title: string;
  finished_at?: number | null;
}

export interface WorkoutExerciseRecord {
  id?: number;
  workout_id: number;
  exercise_id?: number | null;
  name: string;
  order: number;
}

export interface WorkoutSetRecord {
  id?: number;
  workout_exercise_id: number;
  set_index: number;
  reps: number;
  weight: number;
  notes?: string;
  done?: boolean;
}

export interface ExerciseRecord {
  id?: number;
  name: string;
  muscle_group?: string;
  created_at: number;
}

export interface WorkoutTemplateRecord {
  id?: number;
  title: string;
  created_at: number;
}

export interface TemplateExerciseRecord {
  id?: number;
  template_id: number;
  exercise_id: number;
  order: number;
}

export interface SkillRecord {
  id?: number;
  engine_id: number;
  name: string;
  created_at: number;
}

export interface SkillSessionRecord {
  id?: number;
  engine_id: number;
  cycle_id?: number | null;
  skill_id: number;
  date: string;
  minutes: number;
  mode: SkillSessionMode;
  started_at?: number | null;
  ended_at?: number | null;
}

export interface BodyProfileRecord {
  id?: number;
  created_at: number;
  updated_at: number;
  createdAt: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: BodyProfileSex;
  activity_level: BodyProfileActivityLevel;
  goal_type: BodyProfileGoalType;
  goal_direction: GoalDirection;
  rate_kg_per_week: RateKgPerWeek;
  daily_calorie_delta: number;
  goal_weight_kg: number | null;
  experience: BodyProfileExperience;
  tracks: BodyProfileTrack[];
  track_config: Partial<Record<BodyProfileTrack, BodyProfileTrackConfig>>;
  diet_type: BodyProfileDietType;
  allergies: string[];
  meals_per_day: BodyProfileMealsPerDay;
  tracking_mode: BodyProfileTrackingMode;
  sleep_hours_avg: number;
  sleep_window: BodyProfileSleepWindow;
  stress_level: BodyProfileStressLevel;
  injuries: string[];
  discipline_mode: BodyProfileDisciplineMode;
}

export interface BodyProgramRecord {
  id?: number;
  profile_id: number;
  goal_type: BodyProgramGoalType;
  goal_direction: GoalDirection;
  rate_kg_per_week: RateKgPerWeek;
  daily_calorie_delta: number;
  sleep_by: string;
  wake_by: string;
  createdAt: string;
  title: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export interface BodyCycleRecord {
  id?: number;
  program_id: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  is_active: boolean;
  completed: boolean;
  created_at: number;
}

export interface ProgramTaskRecord {
  id?: number;
  program_id: number;
  category: ProgramTaskCategory;
  frequency_type: ProgramTaskFrequencyType;
  target_value: number | null;
  unit: string | null;
  module: ProgramTaskModule;
  title: string;
  description: string;
  frequency: ProgramTaskFrequency;
  target: string | null;
  is_locked: boolean;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

export interface ProgramTaskLogRecord {
  id?: number;
  program_id: number;
  task_id: number;
  date: string;
  completed: boolean;
  value: string | null;
}

export interface BodyTaskRecord {
  id?: number;
  programId: number;
  title: string;
  category: BodyTaskCategory;
  isNonNegotiable: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface BodyTaskCompletionRecord {
  id?: number;
  programId: number;
  taskId: number;
  date: string;
  completed: boolean;
  completedAt: string | null;
}

export interface BodyProgramTaskRecord {
  id?: number;
  program_id: number;
  title: string;
  kind: BodyTaskKind;
  target_value: number | null;
  target_unit: string | null;
  locked: boolean;
  is_active: boolean;
  created_at: number;
}

export interface BodyDayLogRecord {
  id?: number;
  program_id: number;
  date_iso: string;
  completed_task_ids: string[];
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export interface MindProgramRecord {
  id?: number;
  start_date: string;
  duration_days: number;
  main_issue: MindIssue;
  deep_work_target_min: number;
  social_cutoff_time: string | null;
  night_shutdown_time: string | null;
  created_at: number;
  archived_at: number | null;
}

export interface MindTaskRecord {
  id?: number;
  program_id: number;
  title: string;
  category: MindTaskCategory;
  locked: boolean;
  is_active?: boolean;
  created_at: number;
}

export interface MindDayLogRecord {
  id?: number;
  program_id: number;
  date_iso: string;
  completed_task_ids: string[];
  created_at: number;
  updated_at: number;
}

export interface MindJournalEntryRecord {
  id?: number;
  program_id: number;
  date_iso: string;
  morning_json: MindMorningJournal | null;
  evening_json: MindEveningJournal | null;
  created_at: number;
  updated_at: number;
}

export interface MindFocusSessionRecord {
  id?: number;
  program_id: number;
  date_iso: string;
  start_time_iso: string;
  end_time_iso: string;
  duration_minutes: number;
  interrupted: boolean;
  interruptions_count?: number;
  interruptions_json?: Array<{ at_minute: number; reason: MindInterruptionReason }>;
}

export interface MindRuleRecord {
  id?: number;
  program_id: number;
  rule_type: MindRuleType;
  params_json: Record<string, unknown>;
  active: boolean;
  created_at: number;
}

export interface MindRuleViolationRecord {
  id?: number;
  program_id: number;
  date_iso: string;
  rule_type: MindRuleType;
  time_iso: string;
  note?: string | null;
  created_at: number;
}

export interface MindWeeklyReviewReflection {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export interface MindWeeklyReviewRecord {
  id?: number;
  program_id: number;
  week_index: number;
  week_start_iso: string;
  week_end_iso: string;
  avg_consistency: number;
  total_focus_minutes: number;
  journal_days_completed: number;
  best_day_iso: string | null;
  worst_day_iso: string | null;
  reflection_json: MindWeeklyReviewReflection;
  feedback_text: string;
  created_at: number;
  updated_at: number;
}

export interface NutritionTargetRecord {
  id?: number;
  program_id: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at: number;
}

export interface NutritionLogRecord {
  id?: number;
  program_id: number;
  date: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  notes?: string;
}

export interface MealRecord {
  id?: number;
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MealLogRecord {
  id?: number;
  date: string;
  time: string;
  mealId: number | null;
  nameSnapshot: string;
  caloriesSnapshot: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface BodyMealRecord {
  id?: number;
  date: string;
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: number;
}

export interface OSProgramRecord {
  id?: number;
  engineId: number;
  kind: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown>;
}

export interface OSProgramTaskRecord {
  id?: number;
  programId: number;
  title: string;
  kind: string;
  isLocked: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown>;
}

export interface OSTaskLogRecord {
  id?: number;
  programId: number;
  taskId: number;
  date: string;
  completed: boolean;
  completedAt: string | null;
}

export interface OSNutritionLogRecord {
  id?: number;
  programId: number;
  date: string;
  mealName: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export type TitanBackup = {
  engines: EngineRecord[];
  modules: ModuleRecord[];
  cycles: CycleRecord[];
  engine_tasks: EngineTaskRecord[];
  daily_logs: DailyLogRecord[];
  focus_sessions: FocusSessionRecord[];
  workouts: WorkoutRecord[];
  workout_exercises: WorkoutExerciseRecord[];
  workout_sets: WorkoutSetRecord[];
  exercises: ExerciseRecord[];
  workout_templates: WorkoutTemplateRecord[];
  template_exercises: TemplateExerciseRecord[];
  skills: SkillRecord[];
  skill_sessions: SkillSessionRecord[];
  body_profiles: BodyProfileRecord[];
  body_programs: BodyProgramRecord[];
  body_cycles: BodyCycleRecord[];
  body_tasks: BodyTaskRecord[];
  body_task_completions: BodyTaskCompletionRecord[];
  body_program_tasks: BodyProgramTaskRecord[];
  body_day_logs: BodyDayLogRecord[];
  mind_programs: MindProgramRecord[];
  mind_tasks: MindTaskRecord[];
  mind_day_logs: MindDayLogRecord[];
  mind_journal_entries: MindJournalEntryRecord[];
  mind_focus_sessions: MindFocusSessionRecord[];
  mind_rules: MindRuleRecord[];
  mind_rule_violations: MindRuleViolationRecord[];
  mind_weekly_reviews: MindWeeklyReviewRecord[];
  program_tasks: ProgramTaskRecord[];
  program_task_logs: ProgramTaskLogRecord[];
  nutrition_targets: NutritionTargetRecord[];
  nutrition_logs: NutritionLogRecord[];
  meals: MealRecord[];
  meal_logs: MealLogRecord[];
  body_meals: BodyMealRecord[];
  os_programs: OSProgramRecord[];
  os_program_tasks: OSProgramTaskRecord[];
  os_task_logs: OSTaskLogRecord[];
  os_nutrition_logs: OSNutritionLogRecord[];
};

export const TITAN_TABLES = [
  "engines",
  "modules",
  "cycles",
  "engine_tasks",
  "daily_logs",
  "focus_sessions",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "exercises",
  "workout_templates",
  "template_exercises",
  "skills",
  "skill_sessions",
  "body_profiles",
  "body_programs",
  "body_cycles",
  "body_tasks",
  "body_task_completions",
  "body_program_tasks",
  "body_day_logs",
  "mind_programs",
  "mind_tasks",
  "mind_day_logs",
  "mind_journal_entries",
  "mind_focus_sessions",
  "mind_rules",
  "mind_rule_violations",
  "mind_weekly_reviews",
  "program_tasks",
  "program_task_logs",
  "nutrition_targets",
  "nutrition_logs",
  "meals",
  "meal_logs",
  "body_meals",
  "os_programs",
  "os_program_tasks",
  "os_task_logs",
  "os_nutrition_logs",
] as const;

class TitanDB extends Dexie {
  engines!: Table<EngineRecord, number>;
  modules!: Table<ModuleRecord, number>;
  cycles!: Table<CycleRecord, number>;
  engine_tasks!: Table<EngineTaskRecord, number>;
  daily_logs!: Table<DailyLogRecord, number>;
  focus_sessions!: Table<FocusSessionRecord, number>;
  workouts!: Table<WorkoutRecord, number>;
  workout_exercises!: Table<WorkoutExerciseRecord, number>;
  workout_sets!: Table<WorkoutSetRecord, number>;
  exercises!: Table<ExerciseRecord, number>;
  workout_templates!: Table<WorkoutTemplateRecord, number>;
  template_exercises!: Table<TemplateExerciseRecord, number>;
  skills!: Table<SkillRecord, number>;
  skill_sessions!: Table<SkillSessionRecord, number>;
  body_profiles!: Table<BodyProfileRecord, number>;
  body_programs!: Table<BodyProgramRecord, number>;
  body_cycles!: Table<BodyCycleRecord, number>;
  body_tasks!: Table<BodyTaskRecord, number>;
  body_task_completions!: Table<BodyTaskCompletionRecord, number>;
  body_program_tasks!: Table<BodyProgramTaskRecord, number>;
  body_day_logs!: Table<BodyDayLogRecord, number>;
  mind_programs!: Table<MindProgramRecord, number>;
  mind_tasks!: Table<MindTaskRecord, number>;
  mind_day_logs!: Table<MindDayLogRecord, number>;
  mind_journal_entries!: Table<MindJournalEntryRecord, number>;
  mind_focus_sessions!: Table<MindFocusSessionRecord, number>;
  mind_rules!: Table<MindRuleRecord, number>;
  mind_rule_violations!: Table<MindRuleViolationRecord, number>;
  mind_weekly_reviews!: Table<MindWeeklyReviewRecord, number>;
  program_tasks!: Table<ProgramTaskRecord, number>;
  program_task_logs!: Table<ProgramTaskLogRecord, number>;
  nutrition_targets!: Table<NutritionTargetRecord, number>;
  nutrition_logs!: Table<NutritionLogRecord, number>;
  meals!: Table<MealRecord, number>;
  meal_logs!: Table<MealLogRecord, number>;
  body_meals!: Table<BodyMealRecord, number>;
  os_programs!: Table<OSProgramRecord, number>;
  os_program_tasks!: Table<OSProgramTaskRecord, number>;
  os_task_logs!: Table<OSTaskLogRecord, number>;
  os_nutrition_logs!: Table<OSNutritionLogRecord, number>;

  constructor() {
    super("TitanProtocolV2");

    this.version(1).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
    });

    this.version(2).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
    });

    this.version(3).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
    });

    this.version(4).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
    });

    this.version(5).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
    });

    this.version(6).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
      body_programs: "++id, profile_id, is_active, created_at, updated_at",
      program_tasks: "++id, program_id, module, frequency, is_locked, is_active, updated_at",
    });

    this.version(7).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
      body_programs: "++id, profile_id, is_active, is_locked, created_at, updated_at",
      program_tasks: "++id, program_id, module, frequency, is_locked, is_active, updated_at",
    });

    this.version(8).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
      body_programs: "++id, profile_id, is_active, is_locked, created_at, updated_at",
      program_tasks: "++id, program_id, module, frequency, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
    });

    this.version(9).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
      body_programs: "++id, profile_id, is_active, is_locked, created_at, updated_at",
      program_tasks: "++id, program_id, module, frequency, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
    });

    this.version(10).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, title, duration_days, start_date, end_date, is_active, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
      body_programs: "++id, profile_id, goal_type, is_active, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
    });

    this.version(11).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles: "++id, updated_at, created_at",
      body_programs: "++id, profile_id, goal_type, is_active, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
    });

    this.version(12).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
    });

    this.version(13).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
    });

    this.version(14).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
    });

    this.version(15).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
    });

    this.version(16).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
    });

    this.version(17).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_programs: "++id, start_date, duration_days, main_issue, created_at, archived_at",
      mind_tasks: "++id, program_id, category, locked, created_at",
      mind_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_journal_entries: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_focus_sessions: "++id, program_id, date_iso, start_time_iso, duration_minutes",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
    });

    this.version(18).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_programs: "++id, start_date, duration_days, main_issue, created_at, archived_at",
      mind_tasks: "++id, program_id, category, locked, is_active, created_at",
      mind_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_journal_entries: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_focus_sessions: "++id, program_id, date_iso, start_time_iso, duration_minutes",
      mind_weekly_reviews:
        "++id, program_id, week_index, week_start_iso, week_end_iso, created_at, updated_at, [program_id+week_index]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
    });

    this.version(19).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_programs: "++id, start_date, duration_days, main_issue, created_at, archived_at",
      mind_tasks: "++id, program_id, category, locked, is_active, created_at",
      mind_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_journal_entries: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_focus_sessions: "++id, program_id, date_iso, start_time_iso, duration_minutes",
      mind_rules: "++id, program_id, rule_type, active, created_at",
      mind_rule_violations: "++id, program_id, date_iso, rule_type, time_iso, created_at",
      mind_weekly_reviews:
        "++id, program_id, week_index, week_start_iso, week_end_iso, created_at, updated_at, [program_id+week_index]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
    });

    this.version(20).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      daily_logs: "++id, cycle_id, module_id, date, completed, value, &[cycle_id+module_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_programs: "++id, start_date, duration_days, main_issue, created_at, archived_at",
      mind_tasks: "++id, program_id, category, locked, is_active, created_at",
      mind_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_journal_entries: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_focus_sessions: "++id, program_id, date_iso, start_time_iso, duration_minutes",
      mind_rules: "++id, program_id, rule_type, active, created_at",
      mind_rule_violations: "++id, program_id, date_iso, rule_type, time_iso, created_at",
      mind_weekly_reviews:
        "++id, program_id, week_index, week_start_iso, week_end_iso, created_at, updated_at, [program_id+week_index]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
      os_programs: "++id, engineId, kind, isActive, startDate, endDate, [engineId+isActive], createdAt",
      os_program_tasks: "++id, programId, kind, isLocked, isActive, [programId+isActive], createdAt",
      os_task_logs: "++id, programId, taskId, date, completed, &[programId+taskId+date], [programId+date]",
      os_nutrition_logs: "++id, programId, date, mealName, [programId+date]",
    });

    this.version(21).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      engine_tasks: "++id, engine_id, is_active, is_non_negotiable, created_at",
      daily_logs:
        "++id, cycle_id, module_id, engine_id, date, completed, value, completed_task_ids, &[cycle_id+module_id+date], &[engine_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_programs: "++id, start_date, duration_days, main_issue, created_at, archived_at",
      mind_tasks: "++id, program_id, category, locked, is_active, created_at",
      mind_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_journal_entries: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_focus_sessions: "++id, program_id, date_iso, start_time_iso, duration_minutes",
      mind_rules: "++id, program_id, rule_type, active, created_at",
      mind_rule_violations: "++id, program_id, date_iso, rule_type, time_iso, created_at",
      mind_weekly_reviews:
        "++id, program_id, week_index, week_start_iso, week_end_iso, created_at, updated_at, [program_id+week_index]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
      os_programs:
        "++id, engineId, kind, isActive, startDate, endDate, [engineId+isActive], createdAt",
      os_program_tasks: "++id, programId, kind, isLocked, isActive, [programId+isActive], createdAt",
      os_task_logs: "++id, programId, taskId, date, completed, &[programId+taskId+date], [programId+date]",
      os_nutrition_logs: "++id, programId, date, mealName, [programId+date]",
    });

    this.version(22).stores({
      engines: "++id, name, is_active, created_at",
      modules: "++id, engine_id, name, is_core, is_active",
      cycles:
        "++id, engine_id, module_id, is_active, is_archived, start_date, end_date, archived_at, is_primary, total_completed_days",
      engine_tasks: "++id, engine_id, is_active, is_non_negotiable, created_at",
      daily_logs:
        "++id, cycle_id, module_id, engine_id, date, completed, value, completed_task_ids, &[cycle_id+module_id+date], &[engine_id+date]",
      focus_sessions:
        "++id, engine_id, cycle_id, started_at, ended_at, duration_min, mode, completed",
      workouts: "++id, engine_id, cycle_id, date, title, finished_at",
      workout_exercises: "++id, workout_id, exercise_id, name, order",
      workout_sets: "++id, workout_exercise_id, set_index, reps, weight, notes, done",
      exercises: "++id, name, created_at",
      workout_templates: "++id, title, created_at",
      template_exercises: "++id, template_id, exercise_id, order",
      skills: "++id, engine_id, name, created_at",
      skill_sessions:
        "++id, engine_id, cycle_id, skill_id, date, minutes, mode, started_at, ended_at",
      body_profiles:
        "++id, updated_at, created_at, createdAt, goal_direction, rate_kg_per_week",
      body_programs:
        "++id, profile_id, goal_type, goal_direction, rate_kg_per_week, is_active, sleep_by, wake_by, created_at, archived_at",
      body_cycles: "++id, program_id, is_active, completed, start_date, end_date, created_at",
      body_tasks: "++id, programId, category, isNonNegotiable, isActive, createdAt",
      body_task_completions:
        "++id, programId, taskId, date, completed, completedAt, &[taskId+date], [programId+date]",
      body_program_tasks:
        "++id, program_id, locked, is_active, created_at, kind, [program_id+created_at]",
      body_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_programs: "++id, start_date, duration_days, main_issue, created_at, archived_at",
      mind_tasks: "++id, program_id, category, locked, is_active, created_at",
      mind_day_logs: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_journal_entries: "++id, program_id, date_iso, updated_at, &[program_id+date_iso]",
      mind_focus_sessions: "++id, program_id, date_iso, start_time_iso, duration_minutes",
      mind_rules: "++id, program_id, rule_type, active, created_at",
      mind_rule_violations: "++id, program_id, date_iso, rule_type, time_iso, created_at",
      mind_weekly_reviews:
        "++id, program_id, week_index, week_start_iso, week_end_iso, created_at, updated_at, [program_id+week_index]",
      program_tasks:
        "++id, program_id, category, frequency_type, is_locked, is_active, updated_at",
      program_task_logs: "++id, program_id, task_id, date, completed, &[program_id+task_id+date]",
      nutrition_targets: "++id, program_id, created_at",
      nutrition_logs: "++id, program_id, date, &[program_id+date]",
      meals: "++id, name, calories, protein, carbs, fat",
      meal_logs: "++id, date, time, mealId, nameSnapshot, [date+time]",
      body_meals: "++id, date, created_at, [date+created_at]",
      os_programs:
        "++id, engineId, kind, isActive, startDate, endDate, [engineId+isActive], createdAt",
      os_program_tasks: "++id, programId, kind, isLocked, isActive, [programId+isActive], createdAt",
      os_task_logs: "++id, programId, taskId, date, completed, &[programId+taskId+date], [programId+date]",
      os_nutrition_logs: "++id, programId, date, mealName, [programId+date]",
    });
  }
}

export const db = new TitanDB();
