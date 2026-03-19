import Dexie, { type Table, type UpdateSpec } from "dexie";
import { assertDateISO } from "./date";

export type BodyMeta = {
  id: "body";
  startDate: string;
  createdAt: number;
};

export type BodyTask = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
  /** How many days per week this task is required (1–7). 7 = every day. Resets on Monday. */
  daysPerWeek?: number;
};

export type BodyLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type MindMeta = {
  id: "mind";
  startDate: string;
  createdAt: number;
};

export type MindTask = {
  id: string;
  createdAt: string;
  title: string;
  kind: "main" | "secondary";
  isActive: boolean;
  /** How many days per week this task is required (1–7). 7 = every day. Resets on Monday. */
  daysPerWeek?: number;
};

export type MindTaskCompletion = {
  id: string;
  dateKey: string;
  taskId: string;
  completed: boolean;
  completedAt: string | null;
};

export type MindPomodoroSettings = {
  id: "settings";
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakAfter: number;
  dailyTarget: number;
  updatedAt: string;
};

export type MindPomodoroDaily = {
  dateISO: string;
  completed: number;
  updatedAt: string;
};

export type MoneyMeta = {
  id: "money";
  startDate: string;
  createdAt: number;
};

export type MoneyTask = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
  /** How many days per week this task is required (1–7). 7 = every day. Resets on Monday. */
  daysPerWeek?: number;
};

export type MoneyLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type MoneyTx = {
  id: string;
  dateISO: string;
  type: "expense" | "income" | "borrowed" | "repayment";
  amount: number;
  category: string | null;
  bucket: "need" | "want" | null;
  note: string | null;
  loanId: string | null;
};

export type MoneyLoan = {
  id: string;
  lender: string | null;
  amount: number;
  dateISO: string;
  dueISO: string | null;
  status: "unpaid" | "paid";
};

export type GeneralMeta = {
  id: "general";
  startDate: string;
  createdAt: number;
};

export type GeneralTask = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
  /** How many days per week this task is required (1–7). 7 = every day. Resets on Monday. */
  daysPerWeek?: number;
};

export type GeneralLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type NutritionProfile = {
  id: string;
  created_at: string;
  updated_at: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: "male" | "female";
  bodyfat_pct: number | null;
  steps_per_day: number;
  workouts_per_week: number;
  activity_multiplier: number;
  goal: "cut" | "bulk" | "maintain";
  rate_kg_per_week: 0 | 0.25 | 0.5 | 0.75 | 1;
  calorie_target: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

export type NutritionMeal = {
  id: string;
  dateISO: string;
  created_at: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

// ---------- Focus Timer ----------
export type FocusSettings = {
  id: "default";
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakAfter: number;
  dailyTarget: number;
};

export type FocusDaily = {
  dateKey: string;
  completedSessions: number;
};

// ---------- Money Deep Work ----------
export type DeepWorkTask = {
  id?: number;
  taskName: string;
  category: "Main Job / College" | "Side Hustle" | "Freelance" | "Investments" | "Other";
  createdAt: number;
};

export type DeepWorkLog = {
  id?: number;
  taskId: number;
  dateKey: string;
  completed: boolean;
  earningsToday: number;
};

// ---------- Gym / Workout ----------
export type GymExercise = {
  id?: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  createdAt: number;
};

export type GymTemplate = {
  id?: number;
  name: string;
  createdAt: number;
};

export type GymTemplateExercise = {
  id?: number;
  templateId: number;
  exerciseId: number;
  order: number;
};

export type GymSession = {
  id?: number;
  dateKey: string;
  templateId: number;
  startedAt: number;
  endedAt: number | null;
};

export type GymSet = {
  id?: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  weight: number;
  reps: number;
};

// ---------- Body Weight ----------
export type BodyWeightEntry = {
  dateKey: string;
  weightKg: number;
  createdAt: number;
};

// ---------- Habits ----------
export type Habit = {
  id?: number;
  title: string;
  engine: "body" | "mind" | "money" | "general" | "all";
  icon: string;
  createdAt: number;
};

export type HabitLog = {
  id?: number;
  habitId: number;
  dateKey: string;
  completed: boolean;
};

// ---------- Journal ----------
export type JournalEntry = {
  dateKey: string;
  content: string;
  updatedAt: number;
};

// ---------- Goals ----------
export type Goal = {
  id?: number;
  title: string;
  engine: "body" | "mind" | "money" | "general" | "all" | "habits";
  type: "consistency" | "count" | "value";
  target: number;
  unit: string;
  deadline: string;
  createdAt: number;
  /** Minimum engine score (0–100) for a day to count as "consistent". Defaults to 50 if absent. */
  threshold?: number;
};

// ---------- Goal Tasks ----------
export type GoalTask = {
  id?: number;
  goalId: number;
  title: string;
  /**
   * "daily"  — must be done every day; optionally linked to an engine task.
   * "once"   — one-time task; permanently done when checked.
   * undefined treated as "once" for backwards compat with v15 records.
   */
  taskType?: "daily" | "once";
  /** Which engine this daily task is linked to. Only relevant when taskType === "daily". */
  engine?: "body" | "mind" | "money" | "general" | null;
  /**
   * Serialized ID of the linked engine task.
   * Body / Money / General: String(numericId)
   * Mind: UUID string
   * Only set when taskType === "daily" and engine is set.
   */
  engineTaskRefId?: string | null;
  /** Used only for "once" tasks — permanently marks them done. */
  completed: boolean;
  createdAt: number;
};

// ---------- Sleep ----------
export type SleepEntry = {
  dateKey: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  notes: string;
  createdAt: number;
};

// ---------- Budgets ----------
export type Budget = {
  id?: number;
  category: string;
  monthlyLimit: number;
  createdAt: number;
};

// ---------- Notifications ----------
export type NotificationSetting = {
  id: string;
  enabled: boolean;
  time: string;
};

// ---------- Achievements ----------
export type Achievement = {
  id?: number;
  type: string;
  unlockedAt: number;
};

class TitanBodyDB extends Dexie {
  body_meta!: Table<BodyMeta, "body">;
  body_tasks!: Table<BodyTask, number>;
  body_logs!: Table<BodyLog, number>;
  mind_meta!: Table<MindMeta, "mind">;
  mind_tasks!: Table<MindTask, string>;
  mind_task_completions!: Table<MindTaskCompletion, string>;
  mind_pomodoro_settings!: Table<MindPomodoroSettings, "settings">;
  mind_pomodoro_daily!: Table<MindPomodoroDaily, string>;
  pomodoro_goal_settings!: Table<MindPomodoroSettings, "settings">;
  pomodoro_daily!: Table<MindPomodoroDaily, string>;
  money_meta!: Table<MoneyMeta, "money">;
  money_tasks!: Table<MoneyTask, number>;
  money_logs!: Table<MoneyLog, number>;
  money_tx!: Table<MoneyTx, string>;
  money_loans!: Table<MoneyLoan, string>;
  general_meta!: Table<GeneralMeta, "general">;
  general_tasks!: Table<GeneralTask, number>;
  general_logs!: Table<GeneralLog, number>;
  nutrition_profiles!: Table<NutritionProfile, string>;
  nutrition_meals!: Table<NutritionMeal, string>;
  focus_settings!: Table<FocusSettings, "default">;
  focus_daily!: Table<FocusDaily, string>;
  deep_work_tasks!: Table<DeepWorkTask, number>;
  deep_work_logs!: Table<DeepWorkLog, number>;
  gym_exercises!: Table<GymExercise, number>;
  gym_templates!: Table<GymTemplate, number>;
  gym_template_exercises!: Table<GymTemplateExercise, number>;
  gym_sessions!: Table<GymSession, number>;
  gym_sets!: Table<GymSet, number>;
  body_weight_entries!: Table<BodyWeightEntry, string>;
  habits!: Table<Habit, number>;
  habit_logs!: Table<HabitLog, number>;
  journal_entries!: Table<JournalEntry, string>;
  goals!: Table<Goal, number>;
  goal_tasks!: Table<GoalTask, number>;
  sleep_entries!: Table<SleepEntry, string>;
  budgets!: Table<Budget, number>;
  notification_settings!: Table<NotificationSetting, string>;
  achievements!: Table<Achievement, number>;

  constructor() {
    super("TitanProtocolBodyDB");
    this.version(1).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, isActive",
      body_logs: "++id, dateKey",
    });
    this.version(2)
      .stores({
        body_meta: "id",
        body_tasks: "++id, dateKey, priority, completed, createdAt",
        body_logs: "++id, dateKey",
      })
      .upgrade(async (tx) => {
        await tx.table("body_tasks").clear();
      });
    this.version(3)
      .stores({
        body_meta: "id",
        body_tasks: "++id, createdAt, priority",
        body_logs: "++id, dateKey",
      })
      .upgrade(async (tx) => {
        const oldTasks = await tx.table("body_tasks").toArray();
        const oldLogs = await tx.table("body_logs").toArray();

        const defsMap = new Map<string, { title: string; priority: "main" | "secondary"; createdAt: number }>();
        let earliestDate: string | null = null;

        for (const task of oldTasks as Array<
          BodyTask & { dateKey?: string; completed?: boolean; priority?: "main" | "secondary" }
        >) {
          const priority = task.priority ?? "main";
          const key = `${task.title}::${priority}`;
          const existing = defsMap.get(key);
          const createdAt = task.createdAt ?? Date.now();
          if (!existing || createdAt < existing.createdAt) {
            defsMap.set(key, { title: task.title, priority, createdAt });
          }
          if (task.dateKey) {
            if (!earliestDate || task.dateKey < earliestDate) earliestDate = task.dateKey;
          }
        }

        const defs = Array.from(defsMap.values());
        await tx.table("body_tasks").clear();
        const ids = defs.length
          ? await tx.table("body_tasks").bulkAdd(defs, { allKeys: true })
          : [];

        const keyToId = new Map<string, number>();
        defs.forEach((def, index) => {
          const id = ids[index] as number;
          keyToId.set(`${def.title}::${def.priority}`, id);
        });

        const logMap = new Map<string, Set<number>>();
        for (const task of oldTasks as Array<
          BodyTask & { dateKey?: string; completed?: boolean; priority?: "main" | "secondary" }
        >) {
          if (!task.dateKey || !task.completed) continue;
          const priority = task.priority ?? "main";
          const key = `${task.title}::${priority}`;
          const id = keyToId.get(key);
          if (!id) continue;
          const set = logMap.get(task.dateKey) ?? new Set<number>();
          set.add(id);
          logMap.set(task.dateKey, set);
        }

        for (const log of oldLogs as Array<BodyLog>) {
          if (!log.dateKey || !log.completedTaskIds?.length) continue;
          const set = logMap.get(log.dateKey) ?? new Set<number>();
          log.completedTaskIds.forEach((id) => set.add(id));
          logMap.set(log.dateKey, set);
        }

        const logs = Array.from(logMap.entries()).map(([dateKey, set]) => ({
          dateKey,
          completedTaskIds: Array.from(set),
          createdAt: Date.now(),
        }));

        await tx.table("body_logs").clear();
        if (logs.length) {
          await tx.table("body_logs").bulkAdd(logs);
        }

        if (earliestDate) {
          const meta = await tx.table("body_meta").get("body");
          if (meta) {
            const nextStartDate = meta.startDate && meta.startDate < earliestDate ? meta.startDate : earliestDate;
            await tx.table("body_meta").update("body", { startDate: nextStartDate });
          }
        }
      });
    this.version(4).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(5).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(6).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(7).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(8).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(9).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(10).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(11).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(12).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
      focus_settings: "id",
      focus_daily: "dateKey",
      deep_work_tasks: "++id, category, createdAt",
      deep_work_logs: "++id, taskId, dateKey, completed",
      gym_exercises: "++id, name, muscleGroup, equipment",
      gym_templates: "++id, name",
      gym_template_exercises: "++id, templateId, exerciseId, order",
      gym_sessions: "++id, dateKey, templateId",
      gym_sets: "++id, sessionId, exerciseId",
      body_weight_entries: "dateKey",
    });
    this.version(13).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
      focus_settings: "id",
      focus_daily: "dateKey",
      deep_work_tasks: "++id, category, createdAt",
      deep_work_logs: "++id, taskId, dateKey, completed",
      gym_exercises: "++id, name, muscleGroup, equipment",
      gym_templates: "++id, name",
      gym_template_exercises: "++id, templateId, exerciseId, order",
      gym_sessions: "++id, dateKey, templateId",
      gym_sets: "++id, sessionId, exerciseId",
      body_weight_entries: "dateKey",
      habits: "++id, title, engine, createdAt",
      habit_logs: "++id, habitId, dateKey, [habitId+dateKey]",
      journal_entries: "dateKey",
      goals: "++id, engine, type, createdAt",
      sleep_entries: "dateKey",
      budgets: "++id, category",
      notification_settings: "id",
      achievements: "++id, type, unlockedAt",
    });
    // Version 14: daysPerWeek field added to task types (optional, no migration needed)
    this.version(14).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
      focus_settings: "id",
      focus_daily: "dateKey",
      deep_work_tasks: "++id, category, createdAt",
      deep_work_logs: "++id, taskId, dateKey, completed",
      gym_exercises: "++id, name, muscleGroup, equipment",
      gym_templates: "++id, name",
      gym_template_exercises: "++id, templateId, exerciseId, order",
      gym_sessions: "++id, dateKey, templateId",
      gym_sets: "++id, sessionId, exerciseId",
      body_weight_entries: "dateKey",
      habits: "++id, title, engine, createdAt",
      habit_logs: "++id, habitId, dateKey, [habitId+dateKey]",
      journal_entries: "dateKey",
      goals: "++id, engine, type, createdAt",
      sleep_entries: "dateKey",
      budgets: "++id, category",
      notification_settings: "id",
      achievements: "++id, type, unlockedAt",
    });
    // Version 15: goal_tasks table added for task-based goal tracking
    this.version(15).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
      focus_settings: "id",
      focus_daily: "dateKey",
      deep_work_tasks: "++id, category, createdAt",
      deep_work_logs: "++id, taskId, dateKey, completed",
      gym_exercises: "++id, name, muscleGroup, equipment",
      gym_templates: "++id, name",
      gym_template_exercises: "++id, templateId, exerciseId, order",
      gym_sessions: "++id, dateKey, templateId",
      gym_sets: "++id, sessionId, exerciseId",
      body_weight_entries: "dateKey",
      habits: "++id, title, engine, createdAt",
      habit_logs: "++id, habitId, dateKey, [habitId+dateKey]",
      journal_entries: "dateKey",
      goals: "++id, engine, type, createdAt",
      goal_tasks: "++id, goalId, completed",
      sleep_entries: "dateKey",
      budgets: "++id, category",
      notification_settings: "id",
      achievements: "++id, type, unlockedAt",
    });
    // Version 16: GoalTask gets taskType + engineTaskRefId (optional fields, no migration needed)
    this.version(16).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      mind_pomodoro_settings: "id, updatedAt",
      mind_pomodoro_daily: "dateISO, updatedAt",
      pomodoro_goal_settings: "id, updatedAt",
      pomodoro_daily: "dateISO, updatedAt",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      money_tx: "id, dateISO, type, category, bucket, loanId",
      money_loans: "id, dateISO, status",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
      focus_settings: "id",
      focus_daily: "dateKey",
      deep_work_tasks: "++id, category, createdAt",
      deep_work_logs: "++id, taskId, dateKey, completed",
      gym_exercises: "++id, name, muscleGroup, equipment",
      gym_templates: "++id, name",
      gym_template_exercises: "++id, templateId, exerciseId, order",
      gym_sessions: "++id, dateKey, templateId",
      gym_sets: "++id, sessionId, exerciseId",
      body_weight_entries: "dateKey",
      habits: "++id, title, engine, createdAt",
      habit_logs: "++id, habitId, dateKey, [habitId+dateKey]",
      journal_entries: "dateKey",
      goals: "++id, engine, type, createdAt",
      goal_tasks: "++id, goalId, taskType, completed",
      sleep_entries: "dateKey",
      budgets: "++id, category",
      notification_settings: "id",
      achievements: "++id, type, unlockedAt",
    });
    // Version 17: Normalize Mind engine field names to camelCase.
    // MindTask: created_at → createdAt, is_active → isActive
    // MindTaskCompletion: dateISO → dateKey, task_id → taskId, completed_at → completedAt
    this.version(17)
      .stores({
        body_meta: "id",
        body_tasks: "++id, createdAt, priority",
        body_logs: "++id, dateKey",
        mind_meta: "id",
        mind_tasks: "id, createdAt, kind, isActive",
        mind_task_completions: "id, dateKey, taskId, completed, [dateKey+taskId]",
        mind_pomodoro_settings: "id, updatedAt",
        mind_pomodoro_daily: "dateISO, updatedAt",
        pomodoro_goal_settings: "id, updatedAt",
        pomodoro_daily: "dateISO, updatedAt",
        money_meta: "id",
        money_tasks: "++id, createdAt, priority",
        money_logs: "++id, dateKey",
        money_tx: "id, dateISO, type, category, bucket, loanId",
        money_loans: "id, dateISO, status",
        general_meta: "id",
        general_tasks: "++id, createdAt, priority",
        general_logs: "++id, dateKey",
        nutrition_profiles: "id, updated_at",
        nutrition_meals: "id, dateISO, created_at",
        focus_settings: "id",
        focus_daily: "dateKey",
        deep_work_tasks: "++id, category, createdAt",
        deep_work_logs: "++id, taskId, dateKey, completed",
        gym_exercises: "++id, name, muscleGroup, equipment",
        gym_templates: "++id, name",
        gym_template_exercises: "++id, templateId, exerciseId, order",
        gym_sessions: "++id, dateKey, templateId",
        gym_sets: "++id, sessionId, exerciseId",
        body_weight_entries: "dateKey",
        habits: "++id, title, engine, createdAt",
        habit_logs: "++id, habitId, dateKey, [habitId+dateKey]",
        journal_entries: "dateKey",
        goals: "++id, engine, type, createdAt",
        goal_tasks: "++id, goalId, taskType, completed",
        sleep_entries: "dateKey",
        budgets: "++id, category",
        notification_settings: "id",
        achievements: "++id, type, unlockedAt",
      })
      .upgrade(async (tx) => {
        // Rename fields in mind_tasks: created_at → createdAt, is_active → isActive
        const mindTasks = await tx.table("mind_tasks").toArray();
        await tx.table("mind_tasks").clear();
        if (mindTasks.length > 0) {
          await tx.table("mind_tasks").bulkAdd(
            mindTasks.map((task: Record<string, unknown>) => {
              const { created_at, is_active, ...rest } = task;
              return {
                ...rest,
                createdAt: created_at ?? new Date().toISOString(),
                isActive: is_active !== false,
              };
            }),
          );
        }

        // Rename fields in mind_task_completions: dateISO → dateKey, task_id → taskId, completed_at → completedAt
        const completions = await tx.table("mind_task_completions").toArray();
        await tx.table("mind_task_completions").clear();
        if (completions.length > 0) {
          await tx.table("mind_task_completions").bulkAdd(
            completions.map((entry: Record<string, unknown>) => {
              const { dateISO, task_id, completed_at, ...rest } = entry;
              return {
                ...rest,
                dateKey: dateISO,
                taskId: task_id,
                completedAt: completed_at ?? null,
              };
            }),
          );
        }
      });
  }
}

export const db = new TitanBodyDB();

// Eagerly open the database so IndexedDB is ready before the first query.
// This avoids a cold-start delay on Windows (WebView2) where the first
// useLiveQuery would otherwise block until the connection is established.
db.open().catch((err) => {
  console.error("[TitanDB] Failed to open database:", err);
});

type EngineTaskRow = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
  daysPerWeek?: number;
};

type EngineLogRow = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type EngineTaskLogHelpers<TTask extends EngineTaskRow, TLog extends EngineLogRow> = {
  listTasks: () => Promise<TTask[]>;
  addTask: (title: string, priority: "main" | "secondary", daysPerWeek?: number) => Promise<number>;
  updateTaskPriority: (taskId: number, priority: "main" | "secondary") => Promise<void>;
  renameTask: (taskId: number, title: string) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  getLog: (dateKey: string) => Promise<TLog | undefined>;
  getOrCreateLog: (dateKey: string) => Promise<TLog>;
  toggleTaskForDate: (dateKey: string, taskId: number) => Promise<TLog>;
  getScoreMapForRange: (startKey: string, endKey: string) => Promise<Record<string, number>>;
};

export function createEngineTaskLogHelpers<TTask extends EngineTaskRow, TLog extends EngineLogRow>(config: {
  taskTable: Table<TTask, number>;
  logTable: Table<TLog, number>;
  computePercentFromLog: (tasks: TTask[], completedTaskIds: number[]) => number;
  onDateTouched?: (dateKey: string) => Promise<void>;
}): EngineTaskLogHelpers<TTask, TLog> {
  const { taskTable, logTable, computePercentFromLog, onDateTouched } = config;

  async function listTasks(): Promise<TTask[]> {
    return taskTable.toArray();
  }

  async function addTask(title: string, priority: "main" | "secondary", daysPerWeek = 7): Promise<number> {
    return taskTable.add({
      title,
      priority,
      daysPerWeek,
      createdAt: Date.now(),
    } as TTask);
  }

  async function updateTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
    await taskTable.update(taskId, { priority } as unknown as UpdateSpec<TTask>);
  }

  async function renameTask(taskId: number, title: string): Promise<void> {
    await taskTable.update(taskId, { title } as unknown as UpdateSpec<TTask>);
  }

  async function deleteTask(taskId: number): Promise<void> {
    await db.transaction("rw", taskTable, logTable, async () => {
      await taskTable.delete(taskId);
      const logs = await logTable.toArray();
      await Promise.all(
        logs.map(async (log) => {
          if (!log.id || !log.completedTaskIds.includes(taskId)) return;
          const nextIds = log.completedTaskIds.filter((id) => id !== taskId);
          await logTable.update(log.id, { completedTaskIds: nextIds } as unknown as UpdateSpec<TLog>);
        }),
      );
    });
  }

  async function getLog(dateKey: string): Promise<TLog | undefined> {
    const safeDate = assertDateISO(dateKey);
    return logTable.where("dateKey").equals(safeDate).first();
  }

  async function getOrCreateLog(dateKey: string): Promise<TLog> {
    const safeDate = assertDateISO(dateKey);
    const existing = await getLog(safeDate);
    if (existing) return existing;
    const createdAt = Date.now();
    const newLog: EngineLogRow = {
      dateKey: safeDate,
      completedTaskIds: [],
      createdAt,
    };
    const id = await logTable.add(newLog as unknown as TLog);
    return { ...newLog, id } as unknown as TLog;
  }

  async function toggleTaskForDate(dateKey: string, taskId: number): Promise<TLog> {
    const safeDate = assertDateISO(dateKey);
    const log = await getOrCreateLog(safeDate);
    const exists = log.completedTaskIds.includes(taskId);
    const nextIds = exists ? log.completedTaskIds.filter((id) => id !== taskId) : [...log.completedTaskIds, taskId];
    if (log.id) {
      await logTable.update(log.id, { completedTaskIds: nextIds } as unknown as UpdateSpec<TLog>);
    }
    if (onDateTouched) {
      await onDateTouched(safeDate);
    }
    return { ...log, completedTaskIds: nextIds };
  }

  async function getScoreMapForRange(startKey: string, endKey: string): Promise<Record<string, number>> {
    const safeStart = assertDateISO(startKey);
    const safeEnd = assertDateISO(endKey);
    const [tasks, logs] = await Promise.all([
      taskTable.toArray(),
      logTable.where("dateKey").between(safeStart, safeEnd, true, true).toArray(),
    ]);
    const scoreMap: Record<string, number> = {};
    for (const log of logs) {
      scoreMap[log.dateKey] = computePercentFromLog(tasks, log.completedTaskIds);
    }
    return scoreMap;
  }

  return {
    listTasks,
    addTask,
    updateTaskPriority,
    renameTask,
    deleteTask,
    getLog,
    getOrCreateLog,
    toggleTaskForDate,
    getScoreMapForRange,
  };
}
