import { archiveBodyProgram, extendBodyProgram, hardResetBodyProgram } from "./body_program";
import { archiveMindProgram, extendMindProgram, hardResetMindProgram } from "./mind";
import { addDaysISO, diffDaysISO, toISODateLocal } from "./date";

type EngineScope = "body" | "mind";

type ProgramLike = {
  start_date: string;
  duration_days: number;
  archived_at?: number | null;
  is_active?: boolean;
};

export type ProgramStatus = {
  start: string;
  end: string;
  dayIndexToday: number;
  isCompleted: boolean;
  isArchived: boolean;
};

export async function archiveProgram(engine: EngineScope, programId: number): Promise<void> {
  if (engine === "body") {
    await archiveBodyProgram(programId);
    return;
  }
  await archiveMindProgram(programId);
}

export async function extendProgram(
  engine: EngineScope,
  programId: number,
  extraDays: 30 | 60 | 90,
): Promise<void> {
  if (engine === "body") {
    await extendBodyProgram(programId, extraDays);
    return;
  }
  await extendMindProgram(programId, extraDays);
}

export async function hardResetProgram(engine: EngineScope, programId: number): Promise<void> {
  if (engine === "body") {
    await hardResetBodyProgram(programId);
    return;
  }
  await hardResetMindProgram(programId);
}

export function getProgramStatus(program: ProgramLike): ProgramStatus {
  const start = program.start_date;
  const end = addDaysISO(start, Math.max(0, program.duration_days - 1));
  const today = toISODateLocal(new Date());
  const windowEnd = today < end ? today : end;
  const dayIndexToday = windowEnd < start ? 0 : diffDaysISO(start, windowEnd) + 1;
  const isArchived =
    (typeof program.archived_at === "number" && program.archived_at > 0) ||
    (typeof program.is_active === "boolean" && !program.is_active);
  const isCompleted = today > end;

  return {
    start,
    end,
    dayIndexToday,
    isCompleted,
    isArchived,
  };
}

export function getMindProgramStatus(program: { start_date: string; duration_days: number; archived_at: number | null }) {
  return getProgramStatus(program);
}

export function getBodyProgramStatus(program: {
  start_date: string;
  duration_days: number;
  archived_at: number | null;
  is_active: boolean;
}) {
  return getProgramStatus(program);
}

export function getProgramEndDate(program: { start_date: string; duration_days: number }): string {
  return addDaysISO(program.start_date, Math.max(0, program.duration_days - 1));
}
