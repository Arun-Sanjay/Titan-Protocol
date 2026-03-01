import {
  db,
  type ProgramTaskCategory,
  type ProgramTaskFrequency,
  type ProgramTaskFrequencyType,
  type ProgramTaskModule,
  type ProgramTaskRecord,
} from "./db";
import { getActiveBodyCycle } from "./body_program";
import { validateProgramTask } from "./schemas";

type TaskPatch = Partial<
  Pick<
    ProgramTaskRecord,
    | "category"
    | "title"
    | "description"
    | "frequency_type"
    | "target_value"
    | "unit"
    | "module"
    | "frequency"
    | "target"
    | "is_active"
  >
>;

function mapModuleToCategory(module: ProgramTaskModule): ProgramTaskCategory {
  if (module === "nutrition") return "nutrition";
  if (module === "sleep") return "sleep";
  if (module === "recovery") return "recovery";
  return "training";
}

function inferModule(category: ProgramTaskCategory): ProgramTaskRecord["module"] {
  if (category === "nutrition") return "nutrition";
  if (category === "sleep") return "sleep";
  if (category === "recovery") return "recovery";
  return "general";
}

function asLegacyTarget(target_value: number | null, unit: string | null): string | null {
  if (target_value === null) return null;
  if (!unit) return String(target_value);
  return `${target_value} ${unit}`;
}

async function ensureTaskMutable(task: ProgramTaskRecord): Promise<void> {
  const cycle = await getActiveBodyCycle(task.program_id);
  if (task.is_locked && cycle?.is_active) {
    throw new Error("Non-Negotiable — locked during active cycle.");
  }
}

export async function updateTask(task_id: number, patch: TaskPatch): Promise<ProgramTaskRecord> {
  const task = await db.program_tasks.get(task_id);
  if (!task) throw new Error("Task not found");
  await ensureTaskMutable(task);

  const category =
    patch.category ??
    (patch.module ? mapModuleToCategory(patch.module) : task.category);
  const frequencyType =
    patch.frequency_type ??
    (patch.frequency && patch.frequency !== "x_per_week" ? patch.frequency : task.frequency_type);
  let targetValue = patch.target_value ?? task.target_value ?? null;
  let unit = patch.unit ?? task.unit ?? null;

  if (patch.target && patch.target !== task.target) {
    const numeric = Number.parseFloat(patch.target);
    if (!Number.isNaN(numeric)) {
      targetValue = numeric;
      unit = patch.target.replace(String(numeric), "").trim() || unit;
    }
  }

  const payload = validateProgramTask({
    ...task,
    ...patch,
    category,
    frequency_type: frequencyType,
    target_value: targetValue,
    unit,
    module: inferModule(category),
    frequency: (patch.frequency ?? frequencyType) as ProgramTaskFrequency,
    target: patch.target ?? asLegacyTarget(targetValue, unit),
    updated_at: Date.now(),
  }) as ProgramTaskRecord;

  await db.program_tasks.put({
    ...payload,
    id: task_id,
  });
  const updated = await db.program_tasks.get(task_id);
  if (!updated) throw new Error("Task not found");
  return updated;
}

export async function deactivateTask(task_id: number): Promise<ProgramTaskRecord> {
  const task = await db.program_tasks.get(task_id);
  if (!task) throw new Error("Task not found");
  const cycle = await getActiveBodyCycle(task.program_id);

  if (task.is_locked && cycle?.is_active) {
    throw new Error("Non-Negotiable — locked during active cycle.");
  }

  const payload = validateProgramTask({
    ...task,
    is_active: false,
    updated_at: Date.now(),
  }) as ProgramTaskRecord;
  await db.program_tasks.put({
    ...payload,
    id: task_id,
  });
  const updated = await db.program_tasks.get(task_id);
  if (!updated) throw new Error("Task not found");
  return updated;
}

export async function addCustomTask(
  program_id: number,
  data: {
    title: string;
    category?: ProgramTaskCategory;
    module?: ProgramTaskModule;
    frequency_type?: ProgramTaskFrequencyType;
    frequency?: ProgramTaskFrequency;
    target_value?: number | null;
    target?: string | null;
    unit?: string | null;
    description?: string;
  },
): Promise<ProgramTaskRecord> {
  const program = await db.body_programs.get(program_id);
  if (!program || !program.is_active) throw new Error("Program not found");

  const now = Date.now();
  const category = data.category ?? (data.module ? mapModuleToCategory(data.module) : "general");
  const frequencyType =
    data.frequency_type ?? (data.frequency && data.frequency !== "x_per_week" ? data.frequency : "daily");
  let targetValue = data.target_value ?? null;
  let unit = data.unit ?? null;
  if (data.target) {
    const numeric = Number.parseFloat(data.target);
    if (!Number.isNaN(numeric)) {
      targetValue = numeric;
      unit = data.target.replace(String(numeric), "").trim() || unit;
    } else if (unit === null) {
      unit = data.target;
    }
  }
  const payload = validateProgramTask({
    program_id,
    title: data.title.trim() || "Custom Task",
    category,
    frequency_type: frequencyType,
    target_value: targetValue,
    unit,
    is_locked: false,
    is_active: true,
    created_at: now,
    updated_at: now,
    module: data.module ?? inferModule(category),
    description: data.description?.trim() || "Custom adjustable task",
    frequency: (data.frequency ?? frequencyType) as ProgramTaskFrequency,
    target: data.target ?? asLegacyTarget(targetValue, unit),
  }) as ProgramTaskRecord;
  const id = await db.program_tasks.add(payload);

  const created = await db.program_tasks.get(id);
  if (!created) throw new Error("Failed to create custom task");
  return created;
}
