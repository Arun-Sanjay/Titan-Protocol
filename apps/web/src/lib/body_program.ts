import {
  type BodyTaskRecord,
  type BodyTaskKind,
  db,
  type BodyDayLogRecord,
  type BodyCycleRecord,
  type GoalDirection,
  type BodyProfileRecord,
  type BodyProgramTaskRecord,
  type BodyProgramGoalType,
  type BodyProgramRecord,
  type ProgramTaskRecord,
  type RateKgPerWeek,
} from "./db";
import { type BodyIntakeAnswers, generateBodyTasks } from "./body_program_generator";
import {
  validateBodyCycle,
  validateBodyProgram,
  validateBodyTask,
  validateProgramTask,
} from "./schemas";

function toDateString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map((item) => Number.parseInt(item, 10));
  const base = new Date(year, (month || 1) - 1, day || 1);
  base.setDate(base.getDate() + days);
  return toDateString(base);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function eachDate(startDate: string, endDate: string): string[] {
  const values: string[] = [];
  if (endDate < startDate) return values;
  const [startYear, startMonth, startDay] = startDate.split("-").map((part) => Number.parseInt(part, 10));
  const [endYear, endMonth, endDay] = endDate.split("-").map((part) => Number.parseInt(part, 10));
  const cursor = new Date(startYear, (startMonth || 1) - 1, startDay || 1);
  const end = new Date(endYear, (endMonth || 1) - 1, endDay || 1);
  while (cursor <= end) {
    values.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

function toIsoNow(value?: number): string {
  return new Date(value ?? Date.now()).toISOString();
}

const MAX_ACTIVE_BODY_PROGRAMS = 1;

export function computeDailyCalorieDelta(
  goal_direction: GoalDirection,
  rate_kg_per_week: RateKgPerWeek,
): number {
  if (goal_direction === "maintain") return 0;

  const magnitude =
    rate_kg_per_week === 0.25
      ? 250
      : rate_kg_per_week === 0.5
        ? 500
        : rate_kg_per_week === 0.75
          ? 750
          : 1000;

  return goal_direction === "cut" ? -magnitude : magnitude;
}

function mapTaskCategoryToBodyCategory(
  category: ProgramTaskRecord["category"],
): BodyTaskRecord["category"] {
  if (category === "sleep") return "sleep";
  if (category === "training") return "training";
  if (category === "nutrition") return "nutrition";
  if (category === "recovery") return "recovery";
  return "custom";
}

function mapBodyCategoryToTaskKind(category: BodyTaskRecord["category"]): BodyTaskKind {
  if (category === "nutrition") return "nutrition";
  if (category === "training") return "training";
  return "habit";
}

function asMeasurableTaskTitle(task: {
  title: string;
  target_value: number | null;
  unit: string | null;
  target: string | null;
}): string {
  if (typeof task.target === "string" && task.target.trim().length > 0) {
    return `${task.title} (${task.target.trim()})`;
  }
  if (task.target_value !== null) {
    const unit = task.unit?.trim();
    return `${task.title} (${task.target_value}${unit ? ` ${unit}` : ""})`;
  }
  return task.title;
}

function isProgramRecordActive(program: BodyProgramRecord): boolean {
  const hasGoalType = typeof (program as { goal_type?: unknown }).goal_type === "string";
  const isArchived = program.archived_at !== null && program.archived_at !== undefined;
  return program.is_active && !isArchived && hasGoalType;
}

async function normalizeLegacyBodyPrograms(): Promise<void> {
  const programs = await db.body_programs.toArray();
  const now = Date.now();

  for (const program of programs) {
    if (!program.id) continue;
    const hasGoalType = typeof (program as { goal_type?: unknown }).goal_type === "string";
    const isArchived = program.archived_at !== null && program.archived_at !== undefined;
    if (!program.is_active) continue;
    if (hasGoalType && !isArchived) continue;

    await db.body_programs.put({
      ...program,
      id: program.id,
      is_active: false,
      updated_at: now,
    });
  }
}

export async function canCreateBodyProgram(): Promise<{ ok: boolean; activeCount: number; max: number }> {
  await normalizeLegacyBodyPrograms();
  const activeCount = await db.body_programs.filter((program) => isProgramRecordActive(program)).count();
  return { ok: activeCount < MAX_ACTIVE_BODY_PROGRAMS, activeCount, max: MAX_ACTIVE_BODY_PROGRAMS };
}

export async function getActiveBodyCycle(program_id: number): Promise<BodyCycleRecord | null> {
  const cycles = await db.body_cycles
    .where("program_id")
    .equals(program_id)
    .filter((cycle) => cycle.is_active)
    .toArray();
  const cycle = cycles.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] ?? null;
  return cycle;
}

export async function getBodyCycles(program_id: number): Promise<BodyCycleRecord[]> {
  const cycles = await db.body_cycles.where("program_id").equals(program_id).toArray();
  return cycles.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

export async function startNewCycle(program_id: number, duration_days: number): Promise<BodyCycleRecord> {
  const program = await db.body_programs.get(program_id);
  if (!program || !program.is_active) {
    throw new Error("Program not active");
  }
  const existing = await getActiveBodyCycle(program_id);
  if (existing) {
    throw new Error("ACTIVE_CYCLE_EXISTS");
  }

  const now = Date.now();
  const start_date = toDateString(new Date());
  const safeDuration = Math.max(1, Math.floor(duration_days));
  const end_date = addDays(start_date, safeDuration - 1);
  const payload = validateBodyCycle({
    program_id,
    start_date,
    end_date,
    duration_days: safeDuration,
    is_active: true,
    completed: false,
    created_at: now,
  }) as BodyCycleRecord;
  const cycleId = await db.body_cycles.add(payload);
  const updatedProgram = validateBodyProgram({
    ...program,
    duration_days: safeDuration,
    start_date,
    end_date,
    updated_at: now,
  }) as BodyProgramRecord;
  await db.body_programs.put({
    ...updatedProgram,
    id: program_id,
  });
  const created = await db.body_cycles.get(cycleId);
  if (!created) {
    throw new Error("Failed to create cycle");
  }
  return created;
}

type CreateBodyProgramResult = { ok: true; program_id: number } | { ok: false; reason: "ACTIVE_PROGRAM_EXISTS" };

export async function createBodyProgram(input: {
  profile_id: number;
  goal_type: BodyProgramGoalType;
  goal_direction: GoalDirection;
  rate_kg_per_week: RateKgPerWeek;
  sleep_by: string;
  wake_by: string;
  duration_days: number;
  title?: string;
  answers: BodyIntakeAnswers;
}): Promise<CreateBodyProgramResult> {
  const profile = await db.body_profiles.get(input.profile_id);
  if (!profile) throw new Error("Body profile not found");

  const safeDuration = Math.max(1, Math.floor(input.duration_days));
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const dailyCalorieDelta = computeDailyCalorieDelta(input.goal_direction, input.rate_kg_per_week);
  const generated = generateBodyTasks(profile, input.answers);

  const result = await db.transaction(
    "rw",
    db.tables,
    async () => {
      const capacity = await canCreateBodyProgram();
      if (!capacity.ok) {
        return { ok: false as const, reason: "ACTIVE_PROGRAM_EXISTS" as const };
      }

      const programPayload = validateBodyProgram({
        profile_id: input.profile_id,
        goal_type: input.goal_type,
        goal_direction: input.goal_direction,
        rate_kg_per_week: input.rate_kg_per_week,
        daily_calorie_delta: dailyCalorieDelta,
        sleep_by: input.sleep_by,
        wake_by: input.wake_by,
        createdAt,
        title: input.title?.trim() || `Body ${input.goal_type.toUpperCase()} Program`,
        duration_days: safeDuration,
        start_date: toDateString(new Date()),
        end_date: addDays(toDateString(new Date()), safeDuration - 1),
        is_active: true,
        is_locked: true,
        created_at: now,
        updated_at: now,
        archived_at: null,
      }) as BodyProgramRecord;
      const programId = await db.body_programs.add(programPayload);

      const start_date = toDateString(new Date());
      const end_date = addDays(start_date, safeDuration - 1);
      const cyclePayload = validateBodyCycle({
        program_id: programId,
        start_date,
        end_date,
        duration_days: safeDuration,
        is_active: true,
        completed: false,
        created_at: now,
      }) as BodyCycleRecord;
      await db.body_cycles.add(cyclePayload);

      const tasks: ProgramTaskRecord[] = generated.tasks.map((task) =>
        validateProgramTask({
          program_id: programId,
          title: task.title,
          category: task.category,
          is_locked: task.is_locked,
          is_active: task.is_active,
          frequency_type: task.frequency_type,
          target_value: task.target_value,
          unit: task.unit,
          created_at: now,
          updated_at: now,
          module: task.module,
          description: task.description,
          frequency: task.frequency,
          target: task.target,
        }) as ProgramTaskRecord,
      );
      if (tasks.length > 0) {
        await db.program_tasks.bulkAdd(tasks);
      }

      const bodyTasks: BodyTaskRecord[] = [
        validateBodyTask({
          programId: programId,
          title: `Sleep by ${input.sleep_by}`,
          category: "sleep",
          isNonNegotiable: true,
          isActive: true,
          createdAt: toIsoNow(now),
        }) as BodyTaskRecord,
        validateBodyTask({
          programId: programId,
          title: `Wake by ${input.wake_by}`,
          category: "sleep",
          isNonNegotiable: true,
          isActive: true,
          createdAt: toIsoNow(now),
        }) as BodyTaskRecord,
        ...tasks.map(
          (task) =>
            validateBodyTask({
              programId: programId,
              title: asMeasurableTaskTitle(task),
              category: mapTaskCategoryToBodyCategory(task.category),
              isNonNegotiable: task.is_locked,
              isActive: task.is_active,
              createdAt: toIsoNow(now),
            }) as BodyTaskRecord,
        ),
      ];
      if (bodyTasks.length > 0) {
        await db.body_tasks.bulkAdd(bodyTasks);
      }

      const programTasksForBody: BodyProgramTaskRecord[] = bodyTasks.map((task) => ({
        program_id: programId,
        title: task.title,
        kind: mapBodyCategoryToTaskKind(task.category),
        target_value: null,
        target_unit: null,
        locked: task.isNonNegotiable,
        is_active: task.isActive,
        created_at: now,
      }));
      if (programTasksForBody.length > 0) {
        await db.body_program_tasks.bulkAdd(programTasksForBody);
      }

      await db.nutrition_targets.add({
        program_id: programId,
        calories: generated.targets.calories,
        protein_g: generated.targets.protein_g,
        fat_g: generated.targets.fat_g,
        carbs_g: generated.targets.carbs_g,
        created_at: now,
      });

      return { ok: true as const, program_id: programId };
    },
  );

  return result;
}

export async function lockBodyProgram(program_id: number): Promise<void> {
  const program = await db.body_programs.get(program_id);
  if (!program) throw new Error("Program not found");

  const payload = validateBodyProgram({
    ...program,
    is_locked: true,
    updated_at: Date.now(),
  }) as BodyProgramRecord;
  await db.body_programs.put({ ...payload, id: program_id });
}

export async function listActiveBodyPrograms(): Promise<BodyProgramRecord[]> {
  await normalizeLegacyBodyPrograms();
  const programs = await db.body_programs.filter((program) => isProgramRecordActive(program)).toArray();
  return programs.sort((first, second) => (second.created_at || 0) - (first.created_at || 0));
}

export async function getActiveBodyProgram(): Promise<
  | {
      program: BodyProgramRecord;
      cycle: BodyCycleRecord | null;
      nutritionTarget: Awaited<ReturnType<typeof db.nutrition_targets.get>> | null;
    }
  | null
> {
  const activePrograms = await listActiveBodyPrograms();
  const program = activePrograms[0] ?? null;
  if (!program?.id) return null;

  const [cycle, targets] = await Promise.all([
    getActiveBodyCycle(program.id),
    db.nutrition_targets.where("program_id").equals(program.id).toArray(),
  ]);

  const nutritionTarget = targets.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] ?? null;

  return { program, cycle, nutritionTarget };
}

export async function extendBodyProgram(program_id: number, extraDays: number): Promise<BodyProgramRecord> {
  const extension = Math.max(1, Math.floor(extraDays));
  const program = await db.body_programs.get(program_id);
  if (!program) throw new Error("Program not found");

  const activeCycle = await getActiveBodyCycle(program_id);
  if (activeCycle?.id) {
    await db.body_cycles.put({
      ...activeCycle,
      id: activeCycle.id,
      end_date: addDays(activeCycle.end_date, extension),
      duration_days: activeCycle.duration_days + extension,
    });
  }

  const payload = validateBodyProgram({
    ...program,
    duration_days: program.duration_days + extension,
    end_date: addDays(program.end_date, extension),
    updated_at: Date.now(),
  }) as BodyProgramRecord;
  await db.body_programs.put({ ...payload, id: program_id });
  const updated = await db.body_programs.get(program_id);
  if (!updated) throw new Error("Program not found");
  return updated;
}

export async function endActiveCycle(program_id: number): Promise<void> {
  const cycle = await getActiveBodyCycle(program_id);
  if (!cycle?.id) {
    throw new Error("No active cycle");
  }
  await db.body_cycles.put({
    ...cycle,
    id: cycle.id,
    is_active: false,
    completed: true,
  });
}

export async function archiveBodyProgram(program_id: number): Promise<BodyProgramRecord> {
  const program = await db.body_programs.get(program_id);
  if (!program) throw new Error("Program not found");

  const cycles = await db.body_cycles.where("program_id").equals(program_id).toArray();
  await db.transaction("rw", db.body_programs, db.body_cycles, async () => {
    for (const cycle of cycles) {
      if (!cycle.id) continue;
      await db.body_cycles.put({
        ...cycle,
        id: cycle.id,
        is_active: false,
      });
    }

    const payload = validateBodyProgram({
      ...program,
      is_active: false,
      archived_at: Date.now(),
      updated_at: Date.now(),
    }) as BodyProgramRecord;
    await db.body_programs.put({ ...payload, id: program_id });
  });

  const updated = await db.body_programs.get(program_id);
  if (!updated) throw new Error("Program not found");
  return updated;
}

export async function getProgramTasks(program_id: number): Promise<ProgramTaskRecord[]> {
  const tasks = await db.program_tasks.where("program_id").equals(program_id).toArray();
  return tasks.sort((first, second) => {
    if (first.is_locked !== second.is_locked) return first.is_locked ? -1 : 1;
    if (first.category === second.category) return first.title.localeCompare(second.title);
    return first.category.localeCompare(second.category);
  });
}

export async function getBodyTasks(programId: number): Promise<BodyTaskRecord[]> {
  const existing = await db.body_tasks.where("programId").equals(programId).toArray();
  if (existing.length > 0) {
    return existing.sort((first, second) => {
      if (first.isNonNegotiable !== second.isNonNegotiable) return first.isNonNegotiable ? -1 : 1;
      return first.title.localeCompare(second.title);
    });
  }

  const legacy = await getProgramTasks(programId);
  const program = await db.body_programs.get(programId);
  if (legacy.length === 0) {
    if (!program?.sleep_by || !program?.wake_by) return [];
    const sleepWakeOnly: BodyTaskRecord[] = [
      validateBodyTask({
        programId,
        title: `Sleep by ${program.sleep_by}`,
        category: "sleep",
        isNonNegotiable: true,
        isActive: true,
        createdAt: toIsoNow(program.created_at),
      }) as BodyTaskRecord,
      validateBodyTask({
        programId,
        title: `Wake by ${program.wake_by}`,
        category: "sleep",
        isNonNegotiable: true,
        isActive: true,
        createdAt: toIsoNow(program.created_at),
      }) as BodyTaskRecord,
    ];
    await db.body_tasks.bulkAdd(sleepWakeOnly);
    return sleepWakeOnly;
  }

  const migrated: BodyTaskRecord[] = legacy.map(
    (task) =>
      validateBodyTask({
        programId,
        title: asMeasurableTaskTitle(task),
        category: mapTaskCategoryToBodyCategory(task.category),
        isNonNegotiable: task.is_locked,
        isActive: task.is_active,
        createdAt: toIsoNow(task.created_at),
      }) as BodyTaskRecord,
  );

  if (migrated.length > 0) {
    const hasSleepBy = migrated.some((task) => task.title.toLowerCase().includes("sleep by"));
    const hasWakeBy = migrated.some((task) => task.title.toLowerCase().includes("wake by"));
    if (!hasSleepBy && program?.sleep_by) {
      migrated.unshift(
        validateBodyTask({
          programId,
          title: `Sleep by ${program.sleep_by}`,
          category: "sleep",
          isNonNegotiable: true,
          isActive: true,
          createdAt: toIsoNow(program.created_at),
        }) as BodyTaskRecord,
      );
    }
    if (!hasWakeBy && program?.wake_by) {
      migrated.unshift(
        validateBodyTask({
          programId,
          title: `Wake by ${program.wake_by}`,
          category: "sleep",
          isNonNegotiable: true,
          isActive: true,
          createdAt: toIsoNow(program.created_at),
        }) as BodyTaskRecord,
      );
    }
    await db.body_tasks.bulkAdd(migrated);
  }

  return migrated.sort((first, second) => {
    if (first.isNonNegotiable !== second.isNonNegotiable) return first.isNonNegotiable ? -1 : 1;
    return first.title.localeCompare(second.title);
  });
}

export async function getBodyProgram(program_id: number): Promise<
  | {
      program: BodyProgramRecord;
      profile: BodyProfileRecord | null;
      cycle: BodyCycleRecord | null;
      cycles: BodyCycleRecord[];
      tasks: ProgramTaskRecord[];
    }
  | null
> {
  const program = await db.body_programs.get(program_id);
  if (!program) return null;

  const [profile, tasks, cycles] = await Promise.all([
    db.body_profiles.get(program.profile_id),
    getProgramTasks(program_id),
    getBodyCycles(program_id),
  ]);
  const cycle = cycles.find((item) => item.is_active) ?? null;

  return { program, profile, cycle, cycles, tasks };
}

function mapTaskKindToBodyCategory(kind: BodyTaskKind): BodyTaskRecord["category"] {
  if (kind === "nutrition") return "nutrition";
  if (kind === "training") return "training";
  return "custom";
}

function sortProgramTasks(tasks: BodyProgramTaskRecord[]): BodyProgramTaskRecord[] {
  return [...tasks].sort((first, second) => {
    if (first.locked !== second.locked) return first.locked ? -1 : 1;
    if (first.is_active !== second.is_active) return first.is_active ? -1 : 1;
    if ((first.created_at || 0) !== (second.created_at || 0)) {
      return (first.created_at || 0) - (second.created_at || 0);
    }
    return first.title.localeCompare(second.title);
  });
}

async function ensureBodyProgramTasks(program_id: number): Promise<BodyProgramTaskRecord[]> {
  const existing = await db.body_program_tasks.where("program_id").equals(program_id).toArray();
  if (existing.length > 0) {
    return sortProgramTasks(existing);
  }

  const fallback = await getBodyTasks(program_id);
  if (fallback.length === 0) {
    return [];
  }

  const now = Date.now();
  const rows: BodyProgramTaskRecord[] = fallback.map((task, index) => ({
    program_id,
    title: task.title,
    kind: mapBodyCategoryToTaskKind(task.category),
    target_value: null,
    target_unit: null,
    locked: task.isNonNegotiable,
    is_active: task.isActive,
    created_at: now + index,
  }));
  await db.body_program_tasks.bulkAdd(rows);
  const created = await db.body_program_tasks.where("program_id").equals(program_id).toArray();
  return sortProgramTasks(created);
}

export async function listProgramTasks(program_id: number): Promise<BodyProgramTaskRecord[]> {
  return ensureBodyProgramTasks(program_id);
}

export async function addProgramTask(
  program_id: number,
  payload: {
    title: string;
    kind?: BodyTaskKind;
    target_value?: number | null;
    target_unit?: string | null;
    locked?: boolean;
  },
): Promise<BodyProgramTaskRecord> {
  const program = await db.body_programs.get(program_id);
  if (!program || !program.is_active) {
    throw new Error("No active program");
  }

  const title = payload.title.trim();
  if (!title) {
    throw new Error("Task title is required");
  }

  await ensureBodyProgramTasks(program_id);

  const now = Date.now();
  const row: Omit<BodyProgramTaskRecord, "id"> = {
    program_id,
    title,
    kind: payload.kind ?? "habit",
    target_value:
      typeof payload.target_value === "number" && Number.isFinite(payload.target_value)
        ? Math.max(0, Math.round(payload.target_value))
        : null,
    target_unit: payload.target_unit?.trim() || null,
    locked: Boolean(payload.locked),
    is_active: true,
    created_at: now,
  };

  const id = await db.body_program_tasks.add(row);
  const created = await db.body_program_tasks.get(id);
  if (!created) {
    throw new Error("Failed to create program task");
  }

  await db.body_tasks.add({
    programId: program_id,
    title,
    category: mapTaskKindToBodyCategory(created.kind),
    isNonNegotiable: created.locked,
    isActive: true,
    createdAt: toIsoNow(now),
  });

  return created;
}

export async function removeProgramTask(task_id: number): Promise<void> {
  const task = await db.body_program_tasks.get(task_id);
  if (!task) {
    throw new Error("Task not found");
  }
  if (task.locked) {
    throw new Error("Locked tasks cannot be removed");
  }
  await db.body_program_tasks.update(task_id, { is_active: false });
}

export async function getDayLog(program_id: number, date_iso: string): Promise<BodyDayLogRecord | null> {
  if (!isIsoDate(date_iso)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  const row = await db.body_day_logs.where("[program_id+date_iso]").equals([program_id, date_iso]).first();
  return row ?? null;
}

export async function getRangeDayLogs(
  program_id: number,
  start_iso: string,
  end_iso: string,
): Promise<BodyDayLogRecord[]> {
  if (!isIsoDate(start_iso) || !isIsoDate(end_iso)) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (end_iso < start_iso) return [];

  const rows = await db.body_day_logs.where("program_id").equals(program_id).toArray();
  return rows
    .filter((row) => row.date_iso >= start_iso && row.date_iso <= end_iso)
    .sort((first, second) => first.date_iso.localeCompare(second.date_iso));
}

export async function toggleTaskForDate(
  program_id: number,
  date_iso: string,
  task_id: number,
): Promise<BodyDayLogRecord> {
  if (!isIsoDate(date_iso)) {
    throw new Error("Date must be YYYY-MM-DD");
  }

  const [program, task] = await Promise.all([
    db.body_programs.get(program_id),
    db.body_program_tasks.get(task_id),
  ]);
  if (!program || !program.is_active) {
    throw new Error("No active program");
  }
  if (!task || task.program_id !== program_id || !task.is_active) {
    throw new Error("Task not found");
  }

  await ensureBodyProgramTasks(program_id);

  const now = Date.now();
  const existing = await getDayLog(program_id, date_iso);
  const taskKey = String(task_id);
  const currentSet = new Set(existing?.completed_task_ids ?? []);
  if (currentSet.has(taskKey)) {
    currentSet.delete(taskKey);
  } else {
    currentSet.add(taskKey);
  }
  const completed_task_ids = [...currentSet];

  if (existing?.id) {
    await db.body_day_logs.update(existing.id, {
      completed_task_ids,
      updated_at: now,
    });
    const updated = await db.body_day_logs.get(existing.id);
    if (!updated) throw new Error("Failed to update day log");
    return updated;
  }

  const id = await db.body_day_logs.add({
    program_id,
    date_iso,
    completed_task_ids,
    notes: null,
    created_at: now,
    updated_at: now,
  });
  const created = await db.body_day_logs.get(id);
  if (!created) throw new Error("Failed to create day log");
  return created;
}

export function computeDayCompletionPercent(
  tasks: BodyProgramTaskRecord[],
  completed_task_ids: string[],
): number {
  const activeTaskIds = tasks
    .filter((task) => task.is_active)
    .map((task) => String(task.id))
    .filter((value): value is string => typeof value === "string");
  const total = activeTaskIds.length;
  if (total === 0) return 0;

  const completedSet = new Set(completed_task_ids);
  const completed = activeTaskIds.filter((taskId) => completedSet.has(taskId)).length;
  return Math.round((completed / total) * 100);
}

export function computeConsistency(
  tasks: BodyProgramTaskRecord[],
  dayLogs: BodyDayLogRecord[],
  startDate: string,
  endDate: string,
): number {
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) {
    return 0;
  }

  const dayLogMap = new Map(dayLogs.map((item) => [item.date_iso, item.completed_task_ids] as const));
  const dates = eachDate(startDate, endDate);
  if (dates.length === 0) return 0;

  const totalPercent = dates.reduce((sum, date) => {
    const completed_task_ids = dayLogMap.get(date) ?? [];
    return sum + computeDayCompletionPercent(tasks, completed_task_ids);
  }, 0);

  return Math.round(totalPercent / dates.length);
}

export async function hardResetBodyProgram(program_id: number): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    await db.body_cycles.where("program_id").equals(program_id).delete();
    await db.body_tasks.where("programId").equals(program_id).delete();
    await db.body_task_completions.where("programId").equals(program_id).delete();
    await db.body_program_tasks.where("program_id").equals(program_id).delete();
    await db.body_day_logs.where("program_id").equals(program_id).delete();
    await db.program_tasks.where("program_id").equals(program_id).delete();
    await db.program_task_logs.where("program_id").equals(program_id).delete();
    await db.nutrition_targets.where("program_id").equals(program_id).delete();
    await db.nutrition_logs.where("program_id").equals(program_id).delete();
    await db.body_programs.delete(program_id);
  });
}
