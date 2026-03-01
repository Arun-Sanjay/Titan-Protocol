import { db, type EngineName, type OSProgramRecord } from "./db";
import { addDaysISO, diffDaysISO, toISODateLocal } from "./date";

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return toISODateLocal(new Date());
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function createProgram(
  engineId: number,
  kind: EngineName,
  startDate: string,
  durationDays: number,
  meta: Record<string, unknown> = {},
  name?: string,
): Promise<OSProgramRecord> {
  if (!isIsoDate(startDate)) {
    throw new Error("startDate must be YYYY-MM-DD");
  }
  const safeDuration = Math.max(1, Math.floor(durationDays));
  const existing = await getActiveProgram(engineId);
  if (existing?.id) {
    throw new Error("ACTIVE_PROGRAM_EXISTS");
  }

  const createdAt = nowIso();
  const id = await db.os_programs.add({
    engineId,
    kind,
    name: name?.trim() || `${kind.toUpperCase()} Program`,
    startDate,
    endDate: addDaysISO(startDate, safeDuration - 1),
    isActive: true,
    createdAt,
    updatedAt: createdAt,
    meta,
  });
  const created = await db.os_programs.get(id);
  if (!created) {
    throw new Error("Failed to create program");
  }
  return created;
}

export async function getActiveProgram(engineId: number): Promise<OSProgramRecord | null> {
  const rows = await db.os_programs
    .where("engineId")
    .equals(engineId)
    .filter((row) => row.isActive)
    .toArray();
  return rows.sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0] ?? null;
}

export async function getProgramsByEngine(engineId: number): Promise<OSProgramRecord[]> {
  const rows = await db.os_programs.where("engineId").equals(engineId).toArray();
  return rows.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function getProgramById(programId: number): Promise<OSProgramRecord | null> {
  return (await db.os_programs.get(programId)) ?? null;
}

export async function endProgram(programId: number): Promise<OSProgramRecord> {
  const program = await db.os_programs.get(programId);
  if (!program) {
    throw new Error("Program not found");
  }
  const now = nowIso();
  await db.os_programs.update(programId, {
    isActive: false,
    endDate: todayIso(),
    updatedAt: now,
  });
  const updated = await db.os_programs.get(programId);
  if (!updated) throw new Error("Program not found");
  return updated;
}

export async function extendProgram(programId: number, addDays: number): Promise<OSProgramRecord> {
  const program = await db.os_programs.get(programId);
  if (!program) {
    throw new Error("Program not found");
  }
  const safeExtra = Math.max(1, Math.floor(addDays));
  await db.os_programs.update(programId, {
    endDate: addDaysISO(program.endDate, safeExtra),
    updatedAt: nowIso(),
  });
  const updated = await db.os_programs.get(programId);
  if (!updated) throw new Error("Program not found");
  return updated;
}

export function getProgramTimeline(program: Pick<OSProgramRecord, "startDate" | "endDate">): {
  totalDays: number;
  dayIndex: number;
  elapsedDays: number;
} {
  const today = todayIso();
  const endForElapsed = today < program.endDate ? today : program.endDate;
  if (endForElapsed < program.startDate) {
    return { totalDays: 0, dayIndex: 0, elapsedDays: 0 };
  }
  const totalDays = Math.max(1, diffDaysISO(program.startDate, program.endDate) + 1);
  const elapsedDays = Math.max(0, diffDaysISO(program.startDate, endForElapsed) + 1);
  return {
    totalDays,
    dayIndex: elapsedDays,
    elapsedDays,
  };
}

export async function ensureEngineProgram(
  engineName: EngineName,
  durationDays = 90,
): Promise<OSProgramRecord> {
  let engine = await db.engines.filter((row) => row.name === engineName).first();
  if (!engine?.id) {
    const id = await db.engines.add({
      name: engineName,
      is_active: true,
      created_at: Date.now(),
    });
    engine = await db.engines.get(id);
  } else if (!engine.is_active && engine.id) {
    await db.engines.update(engine.id, { is_active: true });
    engine = await db.engines.get(engine.id);
  }
  if (!engine?.id) throw new Error("Failed to initialize engine");

  const active = await getActiveProgram(engine.id);
  if (active) return active;

  return createProgram(
    engine.id,
    engineName,
    todayIso(),
    durationDays,
    {},
    `${engineName.toUpperCase()} Program`,
  );
}
