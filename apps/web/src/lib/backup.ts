import { z, type ZodIssue } from "zod";
import { db } from "./db";
import { assertDateISO, isDateISO } from "./date";

const CURRENT_DB_SCHEMA_VERSION = Math.trunc(db.verno);

const integerSchema = z.coerce.number().int();
const nonNegativeIntegerSchema = integerSchema.min(0);
const timestampSchema = nonNegativeIntegerSchema;
const optionalNumberIdSchema = nonNegativeIntegerSchema.optional();
const stringIdSchema = z.string().trim().min(1);
const dateKeySchema = z
  .preprocess((value) => normalizeDateKeyInput(value), z.string())
  .refine((value) => isDateISO(value), "Expected YYYY-MM-DD date key")
  .transform((value) => assertDateISO(value));
const dateTimeSchema = z
  .preprocess((value) => normalizeDateTimeInput(value), z.string())
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected ISO datetime");
const nullableStringSchema = z.preprocess((value) => (value === undefined ? null : value), z.string().nullable());
const completedTaskIdsSchema = z.preprocess(
  (value) => (value == null ? [] : value),
  z.array(nonNegativeIntegerSchema),
);
const daysPerWeekSchema = z.coerce.number().int().min(1).max(7).optional().default(7);

const bodyMetaSchema = z
  .object({
    id: z.literal("body"),
    startDate: dateKeySchema,
    createdAt: timestampSchema,
  })
  .passthrough();
const moneyMetaSchema = z
  .object({
    id: z.literal("money"),
    startDate: dateKeySchema,
    createdAt: timestampSchema,
  })
  .passthrough();
const generalMetaSchema = z
  .object({
    id: z.literal("general"),
    startDate: dateKeySchema,
    createdAt: timestampSchema,
  })
  .passthrough();
const mindMetaSchema = z
  .object({
    id: z.literal("mind"),
    startDate: dateKeySchema,
    createdAt: timestampSchema,
  })
  .passthrough();

const engineTaskSchema = z
  .object({
    id: optionalNumberIdSchema,
    title: z.string().trim().min(1),
    priority: z.enum(["main", "secondary"]),
    createdAt: timestampSchema,
    daysPerWeek: daysPerWeekSchema,
  })
  .passthrough();
const engineLogSchema = z
  .object({
    id: optionalNumberIdSchema,
    dateKey: dateKeySchema,
    completedTaskIds: completedTaskIdsSchema,
    createdAt: timestampSchema,
  })
  .passthrough();

const mindTaskSchema = z
  .object({
    id: stringIdSchema,
    createdAt: dateTimeSchema,
    title: z.string().trim().min(1),
    kind: z.enum(["main", "secondary"]),
    isActive: z.boolean().optional().default(true),
    daysPerWeek: daysPerWeekSchema,
  })
  .passthrough();
const mindTaskCompletionSchema = z
  .object({
    id: stringIdSchema,
    dateKey: dateKeySchema,
    taskId: stringIdSchema,
    completed: z.boolean(),
    completedAt: z.preprocess((value) => (value === undefined ? null : value), z.union([dateTimeSchema, z.null()])),
  })
  .passthrough();
const mindPomodoroSettingsSchema = z
  .object({
    id: z.literal("settings"),
    focusMinutes: nonNegativeIntegerSchema,
    breakMinutes: nonNegativeIntegerSchema,
    longBreakMinutes: nonNegativeIntegerSchema,
    longBreakAfter: nonNegativeIntegerSchema,
    dailyTarget: nonNegativeIntegerSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();
const mindPomodoroDailySchema = z
  .object({
    dateISO: dateKeySchema,
    completed: nonNegativeIntegerSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

const moneyTxSchema = z
  .object({
    id: stringIdSchema,
    dateISO: dateKeySchema,
    type: z.enum(["expense", "income", "borrowed", "repayment"]),
    amount: z.coerce.number(),
    category: nullableStringSchema,
    bucket: z.preprocess(
      (value) => (value === undefined ? null : value),
      z.union([z.enum(["need", "want"]), z.null()]),
    ),
    note: nullableStringSchema,
    loanId: nullableStringSchema,
  })
  .passthrough();
const moneyLoanSchema = z
  .object({
    id: stringIdSchema,
    lender: nullableStringSchema,
    amount: z.coerce.number(),
    dateISO: dateKeySchema,
    dueISO: z.preprocess((value) => (value === undefined ? null : value), z.union([dateKeySchema, z.null()])),
    status: z.enum(["unpaid", "paid"]),
  })
  .passthrough();

const nutritionProfileSchema = z
  .object({
    id: stringIdSchema,
    created_at: dateTimeSchema,
    updated_at: dateTimeSchema,
    height_cm: z.coerce.number(),
    weight_kg: z.coerce.number(),
    age: nonNegativeIntegerSchema,
    sex: z.enum(["male", "female"]),
    bodyfat_pct: z.preprocess((value) => (value === undefined ? null : value), z.number().nullable()),
    steps_per_day: nonNegativeIntegerSchema,
    workouts_per_week: nonNegativeIntegerSchema,
    activity_multiplier: z.coerce.number(),
    goal: z.enum(["cut", "bulk", "maintain"]),
    rate_kg_per_week: z.union([
      z.literal(0),
      z.literal(0.25),
      z.literal(0.5),
      z.literal(0.75),
      z.literal(1),
    ]),
    calorie_target: z.coerce.number(),
    protein_g: z.coerce.number(),
    carbs_g: z.preprocess((value) => (value === undefined ? null : value), z.number().nullable()),
    fat_g: z.preprocess((value) => (value === undefined ? null : value), z.number().nullable()),
  })
  .passthrough();
const nutritionMealSchema = z
  .object({
    id: stringIdSchema,
    dateISO: dateKeySchema,
    created_at: dateTimeSchema,
    name: z.string().trim().min(1),
    calories: z.coerce.number(),
    protein_g: z.coerce.number(),
    carbs_g: z.preprocess((value) => (value === undefined ? null : value), z.number().nullable()),
    fat_g: z.preprocess((value) => (value === undefined ? null : value), z.number().nullable()),
  })
  .passthrough();

const focusSettingsSchema = z
  .object({
    id: z.literal("default"),
    focusMinutes: nonNegativeIntegerSchema,
    breakMinutes: nonNegativeIntegerSchema,
    longBreakMinutes: nonNegativeIntegerSchema,
    longBreakAfter: nonNegativeIntegerSchema,
    dailyTarget: nonNegativeIntegerSchema,
  })
  .passthrough();
const focusDailySchema = z
  .object({
    dateKey: dateKeySchema,
    completedSessions: nonNegativeIntegerSchema,
  })
  .passthrough();

const deepWorkTaskSchema = z
  .object({
    id: optionalNumberIdSchema,
    taskName: z.string().trim().min(1),
    category: z.enum(["Main Job / College", "Side Hustle", "Freelance", "Investments", "Other"]),
    createdAt: timestampSchema,
  })
  .passthrough();
const deepWorkLogSchema = z
  .object({
    id: optionalNumberIdSchema,
    taskId: nonNegativeIntegerSchema,
    dateKey: dateKeySchema,
    completed: z.boolean(),
    earningsToday: z.coerce.number(),
  })
  .passthrough();

const gymExerciseSchema = z
  .object({
    id: optionalNumberIdSchema,
    name: z.string().trim().min(1),
    muscleGroup: z.string().trim().min(1),
    equipment: z.string().trim().min(1),
    createdAt: timestampSchema,
  })
  .passthrough();
const gymTemplateSchema = z
  .object({
    id: optionalNumberIdSchema,
    name: z.string().trim().min(1),
    createdAt: timestampSchema,
  })
  .passthrough();
const gymTemplateExerciseSchema = z
  .object({
    id: optionalNumberIdSchema,
    templateId: nonNegativeIntegerSchema,
    exerciseId: nonNegativeIntegerSchema,
    order: nonNegativeIntegerSchema,
  })
  .passthrough();
const gymSessionSchema = z
  .object({
    id: optionalNumberIdSchema,
    dateKey: dateKeySchema,
    templateId: nonNegativeIntegerSchema,
    startedAt: timestampSchema,
    endedAt: z.preprocess((value) => (value === undefined ? null : value), z.union([timestampSchema, z.null()])),
  })
  .passthrough();
const gymSetSchema = z
  .object({
    id: optionalNumberIdSchema,
    sessionId: nonNegativeIntegerSchema,
    exerciseId: nonNegativeIntegerSchema,
    setIndex: nonNegativeIntegerSchema,
    weight: z.coerce.number(),
    reps: z.coerce.number(),
  })
  .passthrough();

const bodyWeightEntrySchema = z
  .object({
    dateKey: dateKeySchema,
    weightKg: z.coerce.number(),
    createdAt: timestampSchema,
  })
  .passthrough();

const habitSchema = z
  .object({
    id: optionalNumberIdSchema,
    title: z.string().trim().min(1),
    engine: z.enum(["body", "mind", "money", "general", "all"]),
    icon: z.string().trim(),
    createdAt: timestampSchema,
  })
  .passthrough();
const habitLogSchema = z
  .object({
    id: optionalNumberIdSchema,
    habitId: nonNegativeIntegerSchema,
    dateKey: dateKeySchema,
    completed: z.boolean(),
  })
  .passthrough();

const journalEntrySchema = z
  .object({
    dateKey: dateKeySchema,
    content: z.string(),
    updatedAt: timestampSchema,
  })
  .passthrough();

const goalSchema = z
  .object({
    id: optionalNumberIdSchema,
    title: z.string().trim().min(1),
    engine: z.enum(["body", "mind", "money", "general", "all", "habits"]),
    type: z.enum(["consistency", "count", "value"]),
    target: z.coerce.number(),
    unit: z.string().trim(),
    deadline: dateKeySchema,
    createdAt: timestampSchema,
    threshold: z.coerce.number().min(0).max(100).optional(),
  })
  .passthrough();
const goalTaskSchema = z
  .object({
    id: optionalNumberIdSchema,
    goalId: nonNegativeIntegerSchema,
    title: z.string().trim().min(1),
    taskType: z.enum(["daily", "once"]).optional(),
    engine: z
      .preprocess((value) => (value === undefined ? null : value), z.union([z.enum(["body", "mind", "money", "general"]), z.null()])),
    engineTaskRefId: nullableStringSchema,
    completed: z.boolean().optional().default(false),
    createdAt: timestampSchema,
  })
  .passthrough();

const sleepEntrySchema = z
  .object({
    dateKey: dateKeySchema,
    bedtime: z.string().trim().min(1),
    wakeTime: z.string().trim().min(1),
    durationMinutes: nonNegativeIntegerSchema,
    quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    notes: z.string().default(""),
    createdAt: timestampSchema,
  })
  .passthrough();

const budgetSchema = z
  .object({
    id: optionalNumberIdSchema,
    category: z.string().trim().min(1),
    monthlyLimit: z.coerce.number(),
    createdAt: timestampSchema,
  })
  .passthrough();
const notificationSettingSchema = z
  .object({
    id: stringIdSchema,
    enabled: z.boolean(),
    time: z.string().trim().min(1),
  })
  .passthrough();
const achievementSchema = z
  .object({
    id: optionalNumberIdSchema,
    type: z.string().trim().min(1),
    unlockedAt: timestampSchema,
  })
  .passthrough();

const TABLE_ROW_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  body_meta: bodyMetaSchema,
  body_tasks: engineTaskSchema,
  body_logs: engineLogSchema,
  mind_meta: mindMetaSchema,
  mind_tasks: mindTaskSchema,
  mind_task_completions: mindTaskCompletionSchema,
  mind_pomodoro_settings: mindPomodoroSettingsSchema,
  mind_pomodoro_daily: mindPomodoroDailySchema,
  pomodoro_goal_settings: mindPomodoroSettingsSchema,
  pomodoro_daily: mindPomodoroDailySchema,
  money_meta: moneyMetaSchema,
  money_tasks: engineTaskSchema,
  money_logs: engineLogSchema,
  money_tx: moneyTxSchema,
  money_loans: moneyLoanSchema,
  general_meta: generalMetaSchema,
  general_tasks: engineTaskSchema,
  general_logs: engineLogSchema,
  nutrition_profiles: nutritionProfileSchema,
  nutrition_meals: nutritionMealSchema,
  focus_settings: focusSettingsSchema,
  focus_daily: focusDailySchema,
  deep_work_tasks: deepWorkTaskSchema,
  deep_work_logs: deepWorkLogSchema,
  gym_exercises: gymExerciseSchema,
  gym_templates: gymTemplateSchema,
  gym_template_exercises: gymTemplateExerciseSchema,
  gym_sessions: gymSessionSchema,
  gym_sets: gymSetSchema,
  body_weight_entries: bodyWeightEntrySchema,
  habits: habitSchema,
  habit_logs: habitLogSchema,
  journal_entries: journalEntrySchema,
  goals: goalSchema,
  goal_tasks: goalTaskSchema,
  sleep_entries: sleepEntrySchema,
  budgets: budgetSchema,
  notification_settings: notificationSettingSchema,
  achievements: achievementSchema,
};

const backupEnvelopeSchema = z
  .object({
    version: nonNegativeIntegerSchema.optional(),
    exportedAt: dateTimeSchema.optional(),
    tables: z.record(z.string(), z.array(z.unknown())),
  })
  .passthrough();

function normalizeDateKeyInput(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (isDateISO(trimmed)) return assertDateISO(trimmed);
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return trimmed;
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeDateTimeInput(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return trimmed;
  return new Date(parsed).toISOString();
}

function formatIssues(issues: ZodIssue[]): string {
  return issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function normalizeBackupEnvelope(rawParsed: unknown): z.infer<typeof backupEnvelopeSchema> {
  const envelope = backupEnvelopeSchema.safeParse(rawParsed);
  if (!envelope.success) {
    throw new Error(`Invalid backup envelope: ${formatIssues(envelope.error.issues)}`);
  }
  if (
    envelope.data.version !== undefined &&
    envelope.data.version > CURRENT_DB_SCHEMA_VERSION
  ) {
    throw new Error(
      `Backup schema version ${envelope.data.version} is newer than local schema version ${CURRENT_DB_SCHEMA_VERSION}.`,
    );
  }
  return envelope.data;
}

function validateAndNormalizeTables(
  tables: Record<string, unknown[]>,
): Record<string, unknown[]> {
  const missingSchemas = db.tables
    .map((table) => table.name)
    .filter((name) => TABLE_ROW_SCHEMAS[name] === undefined);
  if (missingSchemas.length > 0) {
    throw new Error(
      `Backup import schemas missing for tables: ${missingSchemas.join(", ")}.`,
    );
  }

  const normalized: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = tables[table.name];
    if (rows === undefined) continue;

    const schema = TABLE_ROW_SCHEMAS[table.name];
    const parsedRows = z.array(schema).safeParse(rows);
    if (!parsedRows.success) {
      throw new Error(
        `Invalid rows for table "${table.name}": ${formatIssues(parsedRows.error.issues)}`,
      );
    }
    normalized[table.name] = parsedRows.data;
  }
  return normalized;
}

export async function exportAllData(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  return JSON.stringify(
    {
      version: CURRENT_DB_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tables: data,
    },
    null,
    2,
  );
}

export async function importAllData(jsonString: string): Promise<{ tablesImported: number; rowsImported: number }> {
  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Backup is not valid JSON.");
  }

  const envelope = normalizeBackupEnvelope(rawParsed);
  const normalizedTables = validateAndNormalizeTables(envelope.tables);

  let tablesImported = 0;
  let rowsImported = 0;

  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      const rows = normalizedTables[table.name];
      if (rows === undefined) continue;
      await table.clear();
      if (rows.length > 0) {
        await table.bulkAdd(rows);
      }
      tablesImported++;
      rowsImported += rows.length;
    }
  });

  return { tablesImported, rowsImported };
}

export function downloadJson(jsonString: string, filename: string) {
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getLastBackupTime(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("titan.lastBackupTime");
}

export function setLastBackupTime() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("titan.lastBackupTime", new Date().toISOString());
}
