import {
  db,
  type CycleRecord,
  type DailyLogRecord,
  type EngineName,
  type EngineRecord,
  type EngineTaskRecord,
  type FocusMode,
  type FocusSessionRecord,
  type ModuleRecord,
  type SkillRecord,
  type SkillSessionMode,
  type SkillSessionRecord,
  type WorkoutExerciseRecord,
  type WorkoutRecord,
  type WorkoutSetRecord,
} from "./db";
import { getConsistencyForRange, getProgramConsistency, getTodayCompletionSummary } from "./body_logs";
import { getActiveBodyProgram } from "./body_program";
import { getActiveMindProgram, getMindDailyState, getMindProgramProgress } from "./mind";
import { getProgramAverageConsistency } from "./analytics";
import { getActiveProgram, getProgramTimeline } from "./program";
import { getDayTaskStats } from "./tasks";

const ENGINE_NAMES: EngineName[] = ["body", "mind", "money", "general"];
const DEFAULT_CORE_MODULES = ["Focus", "Execution", "Recovery"];
const DEFAULT_OPTIONAL_MODULES: Record<EngineName, string[]> = {
  body: ["Gym Tracker"],
  mind: ["Pomodoro"],
  money: ["Skill Tracker"],
  general: [],
};
const MAX_ACTIVE_CYCLES = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CycleConsistencyResult = {
  consistency: number;
  completedDays: number;
  elapsedDays: number;
  dayIndex: number;
  totalDays: number;
};

export type EngineScoreCycle = {
  cycle_id: number;
  is_primary: boolean;
  consistency: number;
  dayIndex: number;
  totalDays: number;
};

export type EngineScoreResult = {
  engineScore: number;
  cycles: EngineScoreCycle[];
};

export type TitanScoreResult = {
  titanScore: number;
  breakdown: Array<{ engineName: EngineName; score: number }>;
  activeEnginesCount: number;
};

export type FocusStatsResult = {
  todayUnits: number;
  sessionsToday: FocusSessionRecord[];
  dailyTotals: Array<{ date: string; units: number; minutes: number }>;
};

export type WeeklyWorkoutStatsResult = {
  workoutsCount: number;
  totalSets: number;
  totalVolume: number;
};

export type EngineDashboardStats = {
  engineName: EngineName;
  todayCompletionPct: number;
  dayIndex: number;
  totalDays: number;
  consistencyPct: number;
  isActive: boolean;
};

export type EngineTodayStats = {
  date: string;
  total_active_tasks: number;
  completed_tasks_today: number;
  today_pct: number;
};

export type EngineTodayView = {
  engine: EngineRecord;
  cycle_id: number | null;
  cycle_start_date: string | null;
  cycle_end_date: string | null;
  cycle_day: number;
  cycle_length: number;
  cycle_consistency_pct: number;
  today: EngineTodayStats;
  tasks: EngineTaskRecord[];
};

export type DayColorInput = {
  nonneg_done: number;
  nonneg_total: number;
  total_done: number;
  total_total: number;
};

export type DayColorResult = {
  stage: "empty" | "progress" | "baseline_green" | "full_green";
  intensity: number;
};

export type WorkoutDetail = {
  workout: WorkoutRecord;
  exercises: Array<{
    exercise: WorkoutExerciseRecord;
    sets: WorkoutSetRecord[];
  }>;
};

function normalizeEngineName(value: string): EngineName {
  const normalized = value.trim().toLowerCase();
  if (!ENGINE_NAMES.includes(normalized as EngineName)) {
    throw new Error(`Invalid engine name: ${value}`);
  }
  return normalized as EngineName;
}

function normalizeName(value: string): string {
  return value.trim();
}

function todayDateString(): string {
  return dateToLocalString(new Date());
}

function dateToLocalString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(date: string, days: number): string {
  const base = parseDateOnly(date);
  return dateToLocalString(new Date(base.getTime() + days * MS_PER_DAY));
}

function dayDiffInclusive(fromDate: string, toDate: string): number {
  const from = parseDateOnly(fromDate).getTime();
  const to = parseDateOnly(toDate).getTime();
  if (to < from) return 0;
  return Math.floor((to - from) / MS_PER_DAY) + 1;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function requirePositiveInt(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortCyclesNewest(cycles: CycleRecord[]): CycleRecord[] {
  return [...cycles].sort((first, second) => (second.id ?? 0) - (first.id ?? 0));
}

function getCycleWindowEnd(cycle: CycleRecord): string {
  return todayDateString() < cycle.end_date ? todayDateString() : cycle.end_date;
}

function isDateInCycleWindow(cycle: CycleRecord, date: string): boolean {
  return date >= cycle.start_date && date <= getCycleWindowEnd(cycle);
}

function cycleDayIndex(cycle: CycleRecord): number {
  return dayDiffInclusive(cycle.start_date, getCycleWindowEnd(cycle));
}

function getDefaultOptionalModules(engineName: EngineName): string[] {
  return DEFAULT_OPTIONAL_MODULES[engineName];
}

async function getCycleOrThrow(cycle_id: number): Promise<CycleRecord> {
  const cycle = await db.cycles.get(cycle_id);
  if (!cycle) throw new Error("Cycle not found");
  return cycle;
}

async function getModuleOrThrow(module_id: number): Promise<ModuleRecord> {
  const moduleItem = await db.modules.get(module_id);
  if (!moduleItem) throw new Error("Module not found");
  return moduleItem;
}

async function refreshCycleCompletedDays(cycle_id: number): Promise<number> {
  const { completedDays } = await calculateCycleConsistency(cycle_id);
  return completedDays;
}

async function getCoreModules(engine_id: number): Promise<ModuleRecord[]> {
  return db.modules
    .where("engine_id")
    .equals(engine_id)
    .filter((moduleItem) => moduleItem.is_core && moduleItem.is_active)
    .toArray();
}

async function getCompletedCoreDates(cycle: CycleRecord): Promise<Set<string>> {
  const coreModules = await getCoreModules(cycle.engine_id);
  if (coreModules.length === 0) return new Set();

  const logs = await db.daily_logs.where("cycle_id").equals(cycle.id as number).toArray();
  const coreIds = new Set(coreModules.map((moduleItem) => moduleItem.id as number));
  const dates = new Map<string, Set<number>>();

  for (const log of logs) {
    if (!log.completed || !coreIds.has(log.module_id) || !isDateInCycleWindow(cycle, log.date)) {
      continue;
    }
    const setForDate = dates.get(log.date) ?? new Set<number>();
    setForDate.add(log.module_id);
    dates.set(log.date, setForDate);
  }

  const completedDates = new Set<string>();
  for (const [date, moduleIds] of dates.entries()) {
    if (moduleIds.size === coreIds.size) {
      completedDates.add(date);
    }
  }

  return completedDates;
}

function startOfRange(days: number): string[] {
  const values: string[] = [];
  const today = parseDateOnly(todayDateString()).getTime();
  for (let index = days - 1; index >= 0; index -= 1) {
    values.push(dateToLocalString(new Date(today - index * MS_PER_DAY)));
  }
  return values;
}

export async function syncEngineModules(
  engine_id: number,
  engine_name: EngineName,
): Promise<ModuleRecord[]> {
  return db.transaction("rw", db.modules, async () => {
    const existing = await db.modules.where("engine_id").equals(engine_id).toArray();
    const existingByName = new Map(
      existing.map((moduleItem) => [moduleItem.name.toLowerCase(), moduleItem] as const),
    );

    const additions: ModuleRecord[] = [];

    for (const moduleName of DEFAULT_CORE_MODULES) {
      const existingModule = existingByName.get(moduleName.toLowerCase());
      if (!existingModule) {
        additions.push({
          engine_id,
          name: moduleName,
          is_core: true,
          is_active: true,
        });
      } else if (!existingModule.is_core || !existingModule.is_active) {
        await db.modules.update(existingModule.id as number, {
          is_core: true,
          is_active: true,
        });
      }
    }

    for (const moduleName of getDefaultOptionalModules(engine_name)) {
      if (!existingByName.has(moduleName.toLowerCase())) {
        additions.push({
          engine_id,
          name: moduleName,
          is_core: false,
          is_active: false,
        });
      }
    }

    if (additions.length > 0) {
      await db.modules.bulkAdd(additions);
    }

    return db.modules.where("engine_id").equals(engine_id).toArray();
  });
}

export async function getEngines(): Promise<EngineRecord[]> {
  return db.engines.orderBy("created_at").reverse().toArray();
}

export async function getEngineByName(name: EngineName): Promise<EngineRecord | undefined> {
  const normalized = normalizeEngineName(name);
  return db.engines
    .filter((engine) => engine.name === normalized)
    .first();
}

export async function getOrCreateEngine(name: EngineName): Promise<EngineRecord> {
  const normalized = normalizeEngineName(name);

  return db.transaction("rw", db.engines, db.modules, async () => {
    const existing = await getEngineByName(normalized);
    let engineId: number;

    if (existing?.id) {
      engineId = existing.id;
      if (!existing.is_active) {
        await db.engines.update(engineId, { is_active: true });
      }
    } else {
      engineId = await db.engines.add({
        name: normalized,
        is_active: true,
        created_at: Date.now(),
      });
    }

    await syncEngineModules(engineId, normalized);
    const engine = await db.engines.get(engineId);
    if (!engine) throw new Error("Failed to create engine");
    return engine;
  });
}

export async function activateEngine(name: EngineName): Promise<EngineRecord> {
  return getOrCreateEngine(name);
}

export async function getModulesForEngine(engine_id: number): Promise<ModuleRecord[]> {
  return db.modules.where("engine_id").equals(engine_id).toArray();
}

export async function getModuleByName(
  engine_id: number,
  name: string,
): Promise<ModuleRecord | undefined> {
  const normalized = name.trim().toLowerCase();
  const matches = (await getModulesForEngine(engine_id)).filter(
    (moduleItem) => moduleItem.name.trim().toLowerCase() === normalized,
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  let selected = matches[0];
  let selectedActiveCount = -1;

  for (const moduleItem of matches) {
    const moduleId = moduleItem.id;
    if (!moduleId) continue;
    const activeCount = (await getActiveCycles(engine_id, moduleId)).length;
    if (activeCount > selectedActiveCount) {
      selected = moduleItem;
      selectedActiveCount = activeCount;
      continue;
    }
    if (activeCount === selectedActiveCount) {
      if (moduleItem.is_active && !selected.is_active) {
        selected = moduleItem;
        continue;
      }
      if ((moduleItem.id ?? Number.MAX_SAFE_INTEGER) < (selected.id ?? Number.MAX_SAFE_INTEGER)) {
        selected = moduleItem;
      }
    }
  }

  return selected;
}

export async function setModuleActive(module_id: number, is_active: boolean): Promise<ModuleRecord> {
  return db.transaction("rw", db.modules, async () => {
    const moduleItem = await getModuleOrThrow(module_id);
    if (moduleItem.is_core && !is_active) {
      throw new Error("Core modules cannot be disabled");
    }

    await db.modules.update(module_id, { is_active });
    const updated = await db.modules.get(module_id);
    if (!updated) throw new Error("Failed to update module");
    return updated;
  });
}

export async function getActiveCycles(
  engine_id: number,
  module_id?: number | null,
): Promise<CycleRecord[]> {
  const today = todayDateString();
  const cycles = await db.cycles
    .where("engine_id")
    .equals(engine_id)
    .filter((cycle) => {
      if (!cycle.is_active) return false;
      if (cycle.is_archived === true) return false;
      if (module_id !== undefined && module_id !== null && cycle.module_id !== module_id) {
        return false;
      }
      if (typeof cycle.end_date === "string" && cycle.end_date.length > 0 && cycle.end_date < today) {
        return false;
      }
      return true;
    })
    .toArray();
  return [...cycles].sort((first, second) => second.start_date.localeCompare(first.start_date));
}

export async function getAllCycles(engine_id: number, module_id?: number | null): Promise<CycleRecord[]> {
  const cycles = await db.cycles
    .where("engine_id")
    .equals(engine_id)
    .filter((cycle) => {
      if (module_id === undefined || module_id === null) return true;
      return cycle.module_id === module_id;
    })
    .toArray();
  return sortCyclesNewest(cycles);
}

export async function canCreateCycle(
  engine_id: number,
  module_id?: number | null,
): Promise<{ ok: boolean; activeCount: number; max: number }> {
  const activeCount = (await getActiveCycles(engine_id, module_id)).length;
  if (module_id !== undefined && module_id !== null) {
    return { ok: activeCount < 1, activeCount, max: 1 };
  }
  return { ok: activeCount < MAX_ACTIVE_CYCLES, activeCount, max: MAX_ACTIVE_CYCLES };
}

export async function createCycle(
  engine_id: number,
  title: string,
  duration_days: number,
  is_primary: boolean,
  module_id?: number | null,
): Promise<CycleRecord> {
  const normalizedTitle = normalizeName(title);
  if (!normalizedTitle) throw new Error("Cycle title is required");
  const parsedDuration = requirePositiveInt(duration_days, "duration_days");

  return db.transaction("rw", db.cycles, db.engines, async () => {
    const engine = await db.engines.get(engine_id);
    if (!engine) throw new Error("Engine not found");

    const activeCycles = await getActiveCycles(engine_id, module_id);
    if ((module_id ?? null) !== null && activeCycles.length > 0) {
      const blocking = activeCycles[0];
      throw new Error(`ACTIVE_CYCLE_EXISTS:${blocking.id}:${blocking.title}`);
    }

    const guard = await canCreateCycle(engine_id, module_id);
    if (!guard.ok && (module_id === undefined || module_id === null)) {
      throw new Error(`Max ${guard.max} active cycles per engine`);
    }

    const shouldBePrimary = is_primary || !activeCycles.some((cycle) => cycle.is_primary);
    if (shouldBePrimary) {
      await db.cycles.bulkUpdate(
        activeCycles
          .filter((cycle) => cycle.id)
          .map((cycle) => ({ key: cycle.id as number, changes: { is_primary: false } })),
      );
    }

    const start_date = todayDateString();
    const end_date = addDays(start_date, parsedDuration - 1);
    const cycleId = await db.cycles.add({
      engine_id,
      module_id: module_id ?? null,
      title: normalizedTitle,
      duration_days: parsedDuration,
      start_date,
      end_date,
      is_active: true,
      is_primary: shouldBePrimary,
      is_archived: false,
      archived_at: null,
      total_completed_days: 0,
    });

    const cycle = await db.cycles.get(cycleId);
    if (!cycle) throw new Error("Failed to create cycle");
    return cycle;
  });
}

export async function createGymCycle(
  engine_id: number,
  title: string,
  duration_days: number,
): Promise<CycleRecord> {
  const engine = await db.engines.get(engine_id);
  if (!engine) throw new Error("Engine not found");

  await syncEngineModules(engine_id, engine.name);
  const gymModule = await getModuleByName(engine_id, "Gym Tracker");
  if (!gymModule?.id) throw new Error("Gym module not found");

  return createCycle(engine_id, title, duration_days, true, gymModule.id);
}

export async function setPrimaryCycle(engine_id: number, cycle_id: number): Promise<CycleRecord> {
  return db.transaction("rw", db.cycles, async () => {
    const cycle = await getCycleOrThrow(cycle_id);
    if (cycle.engine_id !== engine_id || !cycle.is_active) {
      throw new Error("Cycle not found");
    }

    const activeCycles = await getActiveCycles(engine_id, cycle.module_id);
    await db.cycles.bulkUpdate(
      activeCycles
        .filter((item) => item.id)
        .map((item) => ({
          key: item.id as number,
          changes: { is_primary: item.id === cycle_id },
        })),
    );

    const updated = await db.cycles.get(cycle_id);
    if (!updated) throw new Error("Failed to set primary cycle");
    return updated;
  });
}

export async function extendCycle(
  cycle_id: number,
  extension_days: 30 | 60 | 90,
): Promise<CycleRecord> {
  return db.transaction("rw", db.cycles, async () => {
    const cycle = await getCycleOrThrow(cycle_id);
    const extension = requirePositiveInt(extension_days, "extension_days");
    await db.cycles.update(cycle_id, {
      duration_days: cycle.duration_days + extension,
      end_date: addDays(cycle.end_date, extension),
    });
    const updated = await db.cycles.get(cycle_id);
    if (!updated) throw new Error("Failed to extend cycle");
    return updated;
  });
}

export async function archiveCycle(cycle_id: number): Promise<CycleRecord> {
  return db.transaction("rw", db.cycles, async () => {
    const cycle = await getCycleOrThrow(cycle_id);
    const archivedAt = new Date().toISOString();
    await db.cycles.update(cycle_id, {
      is_active: false,
      is_primary: false,
      is_archived: true,
      archived_at: archivedAt,
      end_date: todayDateString(),
    });

    if (cycle.is_primary) {
      const remaining = await getActiveCycles(cycle.engine_id, cycle.module_id);
      if (remaining.length > 0) {
        await setPrimaryCycle(cycle.engine_id, remaining[0].id as number);
      }
    }

    const updated = await db.cycles.get(cycle_id);
    if (!updated) throw new Error("Failed to archive cycle");
    return updated;
  });
}

export async function getPrimaryCycle(
  engine_id: number,
  module_id?: number | null,
): Promise<CycleRecord | undefined> {
  const cycles = await getActiveCycles(engine_id, module_id);
  return cycles.find((cycle) => cycle.is_primary) ?? cycles[0];
}

export async function logDaily(
  cycle_id: number,
  module_id: number,
  date: string,
  completed: boolean,
  value = 0,
): Promise<DailyLogRecord> {
  return db.transaction("rw", db.daily_logs, db.cycles, db.modules, async () => {
    const cycle = await getCycleOrThrow(cycle_id);
    const moduleItem = await getModuleOrThrow(module_id);
    if (moduleItem.engine_id !== cycle.engine_id) {
      throw new Error("Module does not belong to cycle engine");
    }

    const duplicate = await db.daily_logs
      .where("[cycle_id+module_id+date]")
      .equals([cycle_id, module_id, date])
      .first();

    if (duplicate?.id) {
      await db.daily_logs.update(duplicate.id, { completed, value });
      await refreshCycleCompletedDays(cycle_id);
      const updated = await db.daily_logs.get(duplicate.id);
      if (!updated) throw new Error("Failed to update daily log");
      return updated;
    }

    const id = await db.daily_logs.add({
      cycle_id,
      module_id,
      date,
      completed,
      value,
    });
    await refreshCycleCompletedDays(cycle_id);
    const created = await db.daily_logs.get(id);
    if (!created) throw new Error("Failed to create daily log");
    return created;
  });
}

export async function getTodayCoreCompletionStatus(cycle_id: number): Promise<boolean> {
  const cycle = await getCycleOrThrow(cycle_id);
  if (!isDateInCycleWindow(cycle, todayDateString())) return false;
  const completedDates = await getCompletedCoreDates(cycle);
  return completedDates.has(todayDateString());
}

export async function calculateCycleConsistency(cycle_id: number): Promise<CycleConsistencyResult> {
  const cycle = await getCycleOrThrow(cycle_id);
  const elapsedDays = dayDiffInclusive(cycle.start_date, getCycleWindowEnd(cycle));
  const dayIndex = elapsedDays;
  const totalDays = cycle.duration_days;

  if (elapsedDays <= 0) {
    return { consistency: 0, completedDays: 0, elapsedDays: 0, dayIndex: 0, totalDays };
  }

  const completedDates = await getCompletedCoreDates(cycle);
  const completedDays = completedDates.size;
  await db.cycles.update(cycle_id, { total_completed_days: completedDays });

  return {
    consistency: clampScore((completedDays / elapsedDays) * 100),
    completedDays,
    elapsedDays,
    dayIndex,
    totalDays,
  };
}

export async function calculateEngineScore(engine_id: number): Promise<EngineScoreResult> {
  const engine = await db.engines.get(engine_id);
  if (!engine) {
    return { engineScore: 0, cycles: [] };
  }

  if (engine.name === "body") {
    const activeProgram = await getActiveBodyProgram();
    const programId = activeProgram?.program.id;
    const cycle = activeProgram?.cycle;
    if (!programId || !cycle?.id) {
      return { engineScore: 0, cycles: [] };
    }

    const windowEnd = todayDateString() < cycle.end_date ? todayDateString() : cycle.end_date;
    const range = await getConsistencyForRange(programId, cycle.start_date, windowEnd);
    const consistency = range.length > 0 ? average(range.map((day) => day.percentComplete)) : 0;
    const dayIndex = dayDiffInclusive(cycle.start_date, windowEnd);

    return {
      engineScore: clampScore(consistency),
      cycles: [
        {
          cycle_id: cycle.id,
          is_primary: true,
          consistency: clampScore(consistency),
          dayIndex,
          totalDays: cycle.duration_days,
        },
      ],
    };
  }

  if (engine.name === "mind") {
    const mindProgram = await getActiveMindProgram();
    if (!mindProgram?.id) {
      return { engineScore: 0, cycles: [] };
    }

    const progress = await getMindProgramProgress(mindProgram.id);
    return {
      engineScore: clampScore(progress.consistency),
      cycles: [
        {
          cycle_id: mindProgram.id,
          is_primary: true,
          consistency: clampScore(progress.consistency),
          dayIndex: progress.dayIndex,
          totalDays: progress.totalDays,
        },
      ],
    };
  }

  if (engine.name === "money" || engine.name === "general") {
    const program = await getActiveProgram(engine_id);
    if (program?.id) {
      const timeline = getProgramTimeline(program);
      const endDate = todayDateString() < program.endDate ? todayDateString() : program.endDate;
      const consistency = await getProgramAverageConsistency(program.id, program.startDate, endDate);
      return {
        engineScore: clampScore(consistency),
        cycles: [
          {
            cycle_id: program.id,
            is_primary: true,
            consistency: clampScore(consistency),
            dayIndex: timeline.dayIndex,
            totalDays: timeline.totalDays,
          },
        ],
      };
    }
  }

  const cycles = await getActiveCycles(engine_id);
  if (cycles.length === 0) {
    return { engineScore: 0, cycles: [] };
  }

  const cycleScores = await Promise.all(
    cycles.map(async (cycle) => {
      const consistency = await calculateCycleConsistency(cycle.id as number);
      return {
        cycle_id: cycle.id as number,
        is_primary: cycle.is_primary,
        consistency: consistency.consistency,
        dayIndex: consistency.dayIndex,
        totalDays: consistency.totalDays,
      };
    }),
  );

  if (cycleScores.length === 1) {
    return {
      engineScore: clampScore(cycleScores[0].consistency),
      cycles: cycleScores,
    };
  }

  const primary = cycleScores.find((cycle) => cycle.is_primary) ?? cycleScores[0];
  const secondaries = cycleScores.filter((cycle) => cycle.cycle_id !== primary.cycle_id);
  const secondaryWeight = secondaries.length > 0 ? 0.4 / secondaries.length : 0;

  const engineScore = clampScore(
    primary.consistency * 0.6 +
      secondaries.reduce((sum, cycle) => sum + cycle.consistency * secondaryWeight, 0),
  );

  return { engineScore, cycles: cycleScores };
}

export async function calculateTitanScore(): Promise<TitanScoreResult> {
  const activeEngines = await db.engines.filter((engine) => engine.is_active).toArray();
  if (activeEngines.length === 0) {
    return { titanScore: 0, breakdown: [], activeEnginesCount: 0 };
  }

  const breakdown = await Promise.all(
    activeEngines.map(async (engine) => {
      const score = await calculateEngineScore(engine.id as number);
      return {
        engineName: engine.name,
        score: score.engineScore,
      };
    }),
  );

  return {
    titanScore: clampScore(average(breakdown.map((item) => item.score))),
    breakdown,
    activeEnginesCount: breakdown.length,
  };
}

async function getCycleTodayCompletionPct(engine_id: number, cycle_id: number): Promise<number> {
  const modules = await getModulesForEngine(engine_id);
  const activeModules = modules.filter((moduleItem) => moduleItem.is_active && moduleItem.id);
  if (activeModules.length === 0) return 0;

  const today = todayDateString();
  const logs = await db.daily_logs.where("cycle_id").equals(cycle_id).toArray();
  const completedIds = new Set(
    logs
      .filter((log) => log.date === today && log.completed)
      .map((log) => log.module_id),
  );

  const completed = activeModules.filter((moduleItem) => completedIds.has(moduleItem.id as number)).length;
  return clampScore((completed / activeModules.length) * 100);
}

export async function getEngineDashboardStats(engineName: EngineName): Promise<EngineDashboardStats> {
  const engine = await getEngineByName(engineName);
  if (!engine?.id || !engine.is_active) {
    return {
      engineName,
      todayCompletionPct: 0,
      dayIndex: 0,
      totalDays: 0,
      consistencyPct: 0,
      isActive: false,
    };
  }

  if (engineName === "body") {
    const activeBodyProgram = await getActiveBodyProgram();
    const programId = activeBodyProgram?.program.id;
    const cycle = activeBodyProgram?.cycle;
    if (!programId || !cycle?.id) {
      return {
        engineName,
        todayCompletionPct: 0,
        dayIndex: 0,
        totalDays: 0,
        consistencyPct: 0,
        isActive: true,
      };
    }

    const today = todayDateString();
    const [todaySummary, consistency] = await Promise.all([
      getTodayCompletionSummary(programId, today),
      getProgramConsistency(programId),
    ]);

    return {
      engineName,
      todayCompletionPct: todaySummary.todayConsistency,
      dayIndex: consistency.dayIndex,
      totalDays: consistency.totalDays,
      consistencyPct: clampScore(consistency.consistency),
      isActive: true,
    };
  }

  if (engineName === "mind") {
    const mindProgram = await getActiveMindProgram();
    if (!mindProgram?.id) {
      return {
        engineName,
        todayCompletionPct: 0,
        dayIndex: 0,
        totalDays: 0,
        consistencyPct: 0,
        isActive: true,
      };
    }

    const today = todayDateString();
    const [progress, todayState] = await Promise.all([
      getMindProgramProgress(mindProgram.id),
      getMindDailyState(mindProgram.id, today),
    ]);

    return {
      engineName,
      todayCompletionPct: clampScore(todayState.percent),
      dayIndex: progress.dayIndex,
      totalDays: progress.totalDays,
      consistencyPct: clampScore(progress.consistency),
      isActive: true,
    };
  }

  const activeProgram = await getActiveProgram(engine.id);
  if (activeProgram?.id) {
    const today = todayDateString();
    const endDate = today < activeProgram.endDate ? today : activeProgram.endDate;
    const [timeline, consistency, dayStats] = await Promise.all([
      Promise.resolve(getProgramTimeline(activeProgram)),
      getProgramAverageConsistency(activeProgram.id, activeProgram.startDate, endDate),
      getDayTaskStats(activeProgram.id, today),
    ]);

    return {
      engineName,
      todayCompletionPct: clampScore(dayStats.pct),
      dayIndex: timeline.dayIndex,
      totalDays: timeline.totalDays,
      consistencyPct: clampScore(consistency),
      isActive: true,
    };
  }

  const primaryCycle = await getPrimaryCycle(engine.id);
  if (!primaryCycle?.id) {
    return {
      engineName,
      todayCompletionPct: 0,
      dayIndex: 0,
      totalDays: 0,
      consistencyPct: 0,
      isActive: true,
    };
  }

  const [todayCompletionPct, cycleConsistency] = await Promise.all([
    getCycleTodayCompletionPct(engine.id, primaryCycle.id),
    calculateCycleConsistency(primaryCycle.id),
  ]);

  return {
    engineName,
    todayCompletionPct,
    dayIndex: cycleConsistency.dayIndex,
    totalDays: cycleConsistency.totalDays,
    consistencyPct: clampScore(cycleConsistency.consistency),
    isActive: true,
  };
}

const DEFAULT_ENGINE_TASKS: Record<
  EngineName,
  Array<{ title: string; is_non_negotiable: boolean }>
> = {
  body: [
    { title: "Sleep target hit", is_non_negotiable: true },
    { title: "Training completed", is_non_negotiable: true },
    { title: "Recovery check", is_non_negotiable: false },
  ],
  mind: [
    { title: "Morning reflection", is_non_negotiable: true },
    { title: "Deep work block", is_non_negotiable: true },
    { title: "Evening reflection", is_non_negotiable: false },
  ],
  money: [
    { title: "30m skill work", is_non_negotiable: true },
    { title: "Revenue task shipped", is_non_negotiable: false },
  ],
  general: [
    { title: "Top 3 priorities executed", is_non_negotiable: true },
    { title: "Daily review", is_non_negotiable: false },
  ],
};

async function ensureEngineTasks(engine: EngineRecord): Promise<EngineTaskRecord[]> {
  const engine_id = engine.id as number;
  const existing = await db.engine_tasks.where("engine_id").equals(engine_id).toArray();
  if (existing.length > 0) {
    return existing.filter((task) => task.is_active);
  }

  const defaults = DEFAULT_ENGINE_TASKS[engine.name] ?? [];
  if (defaults.length === 0) return [];

  const now = Date.now();
  await db.engine_tasks.bulkAdd(
    defaults.map((task) => ({
      engine_id,
      title: task.title,
      is_non_negotiable: task.is_non_negotiable,
      is_locked: task.is_non_negotiable,
      is_active: true,
      created_at: now,
    })),
  );

  return db.engine_tasks.where("engine_id").equals(engine_id).filter((task) => task.is_active).toArray();
}

async function getActiveEngineTasks(engine: EngineRecord): Promise<EngineTaskRecord[]> {
  const tasks = await ensureEngineTasks(engine);
  return tasks.sort((a, b) => {
    if (a.is_non_negotiable !== b.is_non_negotiable) {
      return a.is_non_negotiable ? -1 : 1;
    }
    return (a.created_at ?? 0) - (b.created_at ?? 0);
  });
}

export async function listTasks(
  engine_id: number,
  options?: { include_inactive?: boolean },
): Promise<EngineTaskRecord[]> {
  const tasks = await db.engine_tasks.where("engine_id").equals(engine_id).toArray();
  const filtered = options?.include_inactive ? tasks : tasks.filter((task) => task.is_active);
  return filtered.sort((a, b) => {
    if (a.is_non_negotiable !== b.is_non_negotiable) {
      return a.is_non_negotiable ? -1 : 1;
    }
    return (a.created_at ?? 0) - (b.created_at ?? 0);
  });
}

export async function createTask(input: {
  engine_id: number;
  title: string;
  is_non_negotiable?: boolean;
  is_locked?: boolean;
}): Promise<EngineTaskRecord> {
  const title = normalizeName(input.title);
  if (!title) {
    throw new Error("Task title is required");
  }
  const id = await db.engine_tasks.add({
    engine_id: input.engine_id,
    title,
    is_non_negotiable: Boolean(input.is_non_negotiable),
    is_locked: input.is_locked ?? Boolean(input.is_non_negotiable),
    is_active: true,
    created_at: Date.now(),
    archived_at: null,
  });
  const created = await db.engine_tasks.get(id);
  if (!created) {
    throw new Error("Failed to create task");
  }
  return created;
}

export async function archiveTask(task_id: number): Promise<void> {
  const task = await db.engine_tasks.get(task_id);
  if (!task) {
    throw new Error("Task not found");
  }
  if (task.is_locked) {
    throw new Error("Locked task cannot be archived until cycle is archived");
  }
  await db.engine_tasks.update(task_id, {
    is_active: false,
    archived_at: Date.now(),
  });
}

export function listDatesForCycle(startDate: string, cycleLength: number): string[] {
  if (cycleLength <= 0) return [];
  const dates: string[] = [];
  for (let index = 0; index < cycleLength; index += 1) {
    dates.push(addDays(startDate, index));
  }
  return dates;
}

export function chunkDates(dates: string[], chunkSize = 30): string[][] {
  if (chunkSize <= 0) return [dates];
  const chunks: string[][] = [];
  for (let index = 0; index < dates.length; index += chunkSize) {
    chunks.push(dates.slice(index, index + chunkSize));
  }
  return chunks;
}

export function computeDayColor(input: DayColorInput): DayColorResult {
  const nonneg_total = Math.max(0, input.nonneg_total);
  const nonneg_done = Math.max(0, Math.min(nonneg_total, input.nonneg_done));
  const total_total = Math.max(0, input.total_total);
  const total_done = Math.max(0, Math.min(total_total, input.total_done));

  if (total_total === 0 || total_done === 0) {
    return { stage: "empty", intensity: 0 };
  }

  const nonnegRatio = nonneg_total > 0 ? nonneg_done / nonneg_total : 1;
  const totalRatio = total_done / total_total;

  if (nonnegRatio < 1) {
    return { stage: "progress", intensity: Math.max(0.1, nonnegRatio) };
  }

  if (totalRatio >= 1) {
    return { stage: "full_green", intensity: 1 };
  }

  return { stage: "baseline_green", intensity: Math.max(0.2, totalRatio) };
}

export async function getCycleCompletionMap(
  engine_id: number,
  cycleStartDate: string,
  cycleLength: number,
): Promise<
  Record<
    string,
    { nonneg_done: number; nonneg_total: number; total_done: number; total_total: number }
  >
> {
  const dates = listDatesForCycle(cycleStartDate, cycleLength);
  const tasks = await listTasks(engine_id);
  const nonnegTaskIds = new Set(
    tasks.filter((task) => task.is_non_negotiable).map((task) => task.id as number),
  );
  const allTaskIds = new Set(tasks.map((task) => task.id as number));
  const nonneg_total = nonnegTaskIds.size;
  const total_total = allTaskIds.size;

  const logs = await db.daily_logs.where("engine_id").equals(engine_id).toArray();
  const logByDate = new Map(logs.map((log) => [log.date, log] as const));
  const result: Record<
    string,
    { nonneg_done: number; nonneg_total: number; total_done: number; total_total: number }
  > = {};

  for (const date of dates) {
    const log = logByDate.get(date);
    const completedIds = new Set((log?.completed_task_ids ?? []).filter((taskId) => allTaskIds.has(taskId)));
    let nonneg_done = 0;
    for (const taskId of completedIds) {
      if (nonnegTaskIds.has(taskId)) nonneg_done += 1;
    }
    result[date] = {
      nonneg_done,
      nonneg_total,
      total_done: completedIds.size,
      total_total,
    };
  }

  return result;
}

export async function getOrCreateTodayLog(engine_id: number, date: string): Promise<DailyLogRecord> {
  let log = await db.daily_logs.where("[engine_id+date]").equals([engine_id, date]).first();
  if (log) {
    if (!Array.isArray(log.completed_task_ids)) {
      await db.daily_logs.update(log.id as number, { completed_task_ids: [] });
      log = { ...log, completed_task_ids: [] };
    }
    return log;
  }

  const id = await db.daily_logs.add({
    engine_id,
    date,
    completed_task_ids: [],
  });
  const created = await db.daily_logs.get(id);
  if (!created) {
    throw new Error("Failed to create today log");
  }
  return created;
}

export async function toggleTaskForToday(
  engine_id: number,
  date: string,
  task_id: number,
): Promise<EngineTodayStats> {
  const task = await db.engine_tasks.get(task_id);
  if (!task || task.engine_id !== engine_id || !task.is_active) {
    throw new Error("Task not found");
  }

  const todayLog = await getOrCreateTodayLog(engine_id, date);
  const current = new Set(todayLog.completed_task_ids ?? []);
  if (current.has(task_id)) {
    current.delete(task_id);
  } else {
    current.add(task_id);
  }

  await db.daily_logs.update(todayLog.id as number, {
    completed_task_ids: Array.from(current),
  });

  return computeTodayStats(engine_id, date);
}

export async function computeTodayStats(engine_id: number, date: string): Promise<EngineTodayStats> {
  const engine = await db.engines.get(engine_id);
  if (!engine) {
    return {
      date,
      total_active_tasks: 0,
      completed_tasks_today: 0,
      today_pct: 0,
    };
  }

  const tasks = await getActiveEngineTasks(engine);
  const taskIds = new Set(tasks.map((task) => task.id as number));
  const log = await getOrCreateTodayLog(engine_id, date);
  const completed = (log.completed_task_ids ?? []).filter((taskId) => taskIds.has(taskId)).length;
  const total = tasks.length;

  return {
    date,
    total_active_tasks: total,
    completed_tasks_today: completed,
    today_pct: total === 0 ? 0 : clampScore((completed / total) * 100),
  };
}

export async function getEngineTodayView(
  engineName: EngineName,
  date: string = todayDateString(),
): Promise<EngineTodayView> {
  const engine = await getOrCreateEngine(engineName);
  const engine_id = engine.id as number;
  const tasks = await getActiveEngineTasks(engine);
  const today = await computeTodayStats(engine_id, date);

  const primaryCycle = await getPrimaryCycle(engine_id);
  if (!primaryCycle?.id) {
    return {
      engine,
      cycle_id: null,
      cycle_start_date: null,
      cycle_end_date: null,
      cycle_day: 0,
      cycle_length: 0,
      cycle_consistency_pct: 0,
      today,
      tasks,
    };
  }

  const consistency = await calculateCycleConsistency(primaryCycle.id);
  return {
    engine,
    cycle_id: primaryCycle.id,
    cycle_start_date: primaryCycle.start_date,
    cycle_end_date: primaryCycle.end_date,
    cycle_day: consistency.dayIndex,
    cycle_length: consistency.totalDays,
    cycle_consistency_pct: clampScore(consistency.consistency),
    today,
    tasks,
  };
}

export async function addFocusSession(input: {
  engine_id: number;
  cycle_id?: number | null;
  started_at: number;
  ended_at: number;
  duration_min: number;
  mode: FocusMode;
  completed: boolean;
}): Promise<FocusSessionRecord> {
  const id = await db.focus_sessions.add({
    engine_id: input.engine_id,
    cycle_id: input.cycle_id ?? null,
    started_at: input.started_at,
    ended_at: input.ended_at,
    duration_min: input.duration_min,
    mode: input.mode,
    completed: input.completed,
  });
  const session = await db.focus_sessions.get(id);
  if (!session) throw new Error("Failed to save focus session");
  return session;
}

export async function getFocusStats(engine_id: number, rangeDays = 7): Promise<FocusStatsResult> {
  const dates = startOfRange(rangeDays);
  const dateSet = new Set(dates);
  const sessions = await db.focus_sessions.where("engine_id").equals(engine_id).toArray();
  const filtered = sessions.filter((session) => {
    const date = dateToLocalString(new Date(session.ended_at || session.started_at));
    return dateSet.has(date) && session.completed;
  });

  const dailyTotals = dates.map((date) => {
    const onDate = filtered.filter(
      (session) => dateToLocalString(new Date(session.ended_at || session.started_at)) === date,
    );
    return {
      date,
      units: onDate.filter((session) => session.mode === "pomodoro").length,
      minutes: onDate.reduce((sum, session) => sum + session.duration_min, 0),
    };
  });

  const today = todayDateString();
  return {
    todayUnits: dailyTotals.find((item) => item.date === today)?.units ?? 0,
    sessionsToday: filtered.filter(
      (session) => dateToLocalString(new Date(session.ended_at || session.started_at)) === today,
    ),
    dailyTotals,
  };
}

export async function getTodaysFocusUnits(engine_id: number): Promise<number> {
  const stats = await getFocusStats(engine_id, 1);
  return stats.todayUnits;
}

export async function createWorkout(
  engine_id: number,
  date: string,
  title: string,
  cycle_id?: number | null,
): Promise<WorkoutRecord> {
  const id = await db.workouts.add({
    engine_id,
    cycle_id: cycle_id ?? null,
    date,
    title: normalizeName(title) || "Workout",
  });
  const workout = await db.workouts.get(id);
  if (!workout) throw new Error("Failed to create workout");
  return workout;
}

export async function addExercise(workout_id: number, name: string): Promise<WorkoutExerciseRecord> {
  const existing = await db.workout_exercises.where("workout_id").equals(workout_id).toArray();
  const order = existing.length + 1;
  const id = await db.workout_exercises.add({
    workout_id,
    name: normalizeName(name) || "Exercise",
    order,
  });
  const exercise = await db.workout_exercises.get(id);
  if (!exercise) throw new Error("Failed to add exercise");
  return exercise;
}

export async function addSet(
  workout_exercise_id: number,
  reps: number,
  weight: number,
  notes?: string,
): Promise<WorkoutSetRecord> {
  const existing = await db.workout_sets.where("workout_exercise_id").equals(workout_exercise_id).toArray();
  const id = await db.workout_sets.add({
    workout_exercise_id,
    set_index: existing.length + 1,
    reps,
    weight,
    notes,
  });
  const set = await db.workout_sets.get(id);
  if (!set) throw new Error("Failed to add set");
  return set;
}

export async function getWorkouts(engine_id: number, limit = 10): Promise<WorkoutRecord[]> {
  const workouts = await db.workouts.where("engine_id").equals(engine_id).toArray();
  return workouts
    .sort((first, second) => {
      if (first.date === second.date) return (second.id ?? 0) - (first.id ?? 0);
      return second.date.localeCompare(first.date);
    })
    .slice(0, limit);
}

export async function getWorkoutDetail(workout_id: number): Promise<WorkoutDetail | undefined> {
  const workout = await db.workouts.get(workout_id);
  if (!workout) return undefined;
  const exercises = await db.workout_exercises.where("workout_id").equals(workout_id).toArray();
  const sets = await db.workout_sets.toArray();

  return {
    workout,
    exercises: exercises
      .sort((first, second) => first.order - second.order)
      .map((exercise) => ({
        exercise,
        sets: sets
          .filter((set) => set.workout_exercise_id === exercise.id)
          .sort((first, second) => first.set_index - second.set_index),
      })),
  };
}

export async function getTodaysWorkoutCount(engine_id: number): Promise<number> {
  const today = todayDateString();
  const workouts = await db.workouts.where("engine_id").equals(engine_id).toArray();
  return workouts.filter((workout) => {
    if (typeof workout.finished_at !== "number") return false;
    return dateToLocalString(new Date(workout.finished_at)) === today;
  }).length;
}

export async function getWeeklyWorkoutStats(engine_id: number): Promise<WeeklyWorkoutStatsResult> {
  const workouts = await db.workouts.where("engine_id").equals(engine_id).toArray();
  const today = parseDateOnly(todayDateString()).getTime();
  const weekStart = today - 6 * MS_PER_DAY;

  const completedWorkouts = workouts.filter((workout) => {
    if (typeof workout.finished_at !== "number") return false;
    const completedDate = parseDateOnly(dateToLocalString(new Date(workout.finished_at))).getTime();
    return completedDate >= weekStart && completedDate <= today;
  });

  if (completedWorkouts.length === 0) {
    return { workoutsCount: 0, totalSets: 0, totalVolume: 0 };
  }

  const workoutIds = new Set(completedWorkouts.map((workout) => workout.id as number));
  const workoutExercises = await db.workout_exercises.toArray();
  const workoutExerciseIds = new Set(
    workoutExercises
      .filter((exercise) => workoutIds.has(exercise.workout_id))
      .map((exercise) => exercise.id as number),
  );
  const sets = await db.workout_sets.toArray();
  const linkedSets = sets.filter((set) => workoutExerciseIds.has(set.workout_exercise_id));

  return {
    workoutsCount: completedWorkouts.length,
    totalSets: linkedSets.length,
    totalVolume: linkedSets.reduce((sum, set) => sum + set.weight * set.reps, 0),
  };
}

export async function setActiveSkill(engine_id: number, name: string): Promise<SkillRecord> {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error("Skill name is required");

  const existing = await db.skills
    .where("engine_id")
    .equals(engine_id)
    .filter((skill) => skill.name.toLowerCase() === normalized.toLowerCase())
    .first();

  if (existing) return existing;

  const id = await db.skills.add({
    engine_id,
    name: normalized,
    created_at: Date.now(),
  });
  const skill = await db.skills.get(id);
  if (!skill) throw new Error("Failed to create skill");
  return skill;
}

export async function getSkills(engine_id: number): Promise<SkillRecord[]> {
  const skills = await db.skills.where("engine_id").equals(engine_id).toArray();
  return skills.sort((first, second) => first.name.localeCompare(second.name));
}

export async function addSkillSession(input: {
  engine_id: number;
  cycle_id?: number | null;
  skill_id: number;
  date: string;
  minutes: number;
  mode: SkillSessionMode;
  started_at?: number | null;
  ended_at?: number | null;
}): Promise<SkillSessionRecord> {
  const id = await db.skill_sessions.add({
    engine_id: input.engine_id,
    cycle_id: input.cycle_id ?? null,
    skill_id: input.skill_id,
    date: input.date,
    minutes: input.minutes,
    mode: input.mode,
    started_at: input.started_at ?? null,
    ended_at: input.ended_at ?? null,
  });
  const session = await db.skill_sessions.get(id);
  if (!session) throw new Error("Failed to save skill session");
  return session;
}

export async function getWeeklySkillMinutes(
  engine_id: number,
): Promise<Array<{ date: string; minutes: number }>> {
  const dates = startOfRange(7);
  const dateSet = new Set(dates);
  const sessions = await db.skill_sessions.where("engine_id").equals(engine_id).toArray();
  return dates.map((date) => ({
    date,
    minutes: sessions
      .filter((session) => dateSet.has(session.date) && session.date === date)
      .reduce((sum, session) => sum + session.minutes, 0),
  }));
}

export async function getTodaysSkillMinutes(engine_id: number): Promise<number> {
  const today = todayDateString();
  const sessions = await db.skill_sessions.where("engine_id").equals(engine_id).toArray();
  return sessions
    .filter((session) => session.date === today)
    .reduce((sum, session) => sum + session.minutes, 0);
}
