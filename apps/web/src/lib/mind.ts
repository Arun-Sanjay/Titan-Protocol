import {
  db,
  type EngineRecord,
  type MindDayLogRecord,
  type MindEveningJournal,
  type MindFocusSessionRecord,
  type MindInterruptionReason,
  type MindIssue,
  type MindJournalEntryRecord,
  type MindMorningJournal,
  type MindProgramRecord,
  type MindRuleRecord,
  type MindRuleType,
  type MindRuleViolationRecord,
  type MindTaskRecord,
  type MindWeeklyReviewRecord,
  type MindWeeklyReviewReflection,
} from "./db";
import { addDaysISO, diffDaysISO, toISODateLocal } from "./date";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const MORNING_PROMPTS = [
  "What matters most today?",
  "What might distract me?",
  "How will I respond to distraction?",
] as const;

export const EVENING_PROMPTS = [
  "What did I avoid today?",
  "What went well?",
  "What did I learn?",
  "One sentence of self-compassion.",
] as const;

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeText(value: string): string {
  return value.trim();
}

function parseDateOnly(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

function eachDate(startIso: string, endIso: string): string[] {
  if (endIso < startIso) return [];
  const result: string[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    result.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return result;
}

function nowDateIso(): string {
  return toISODateLocal(new Date());
}

function isTaskActive(task: MindTaskRecord): boolean {
  return task.is_active !== false;
}

function completionSet(dayLog: MindDayLogRecord | null): Set<string> {
  return new Set(dayLog?.completed_task_ids ?? []);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeOptionalTime(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isTime(trimmed)) throw new Error("Time must be HH:mm");
  return trimmed;
}

function normalizeReflection(value: MindWeeklyReviewReflection): MindWeeklyReviewReflection {
  return {
    q1: normalizeText(value.q1),
    q2: normalizeText(value.q2),
    q3: normalizeText(value.q3),
    q4: normalizeText(value.q4),
  };
}

function isMorningComplete(entry: MindJournalEntryRecord | null): boolean {
  const morning = entry?.morning_json;
  if (!morning) return false;
  return [morning.q1, morning.q2, morning.q3].every((value) => value.trim().length > 0);
}

function isEveningComplete(entry: MindJournalEntryRecord | null): boolean {
  const evening = entry?.evening_json;
  if (!evening) return false;
  return [evening.q1, evening.q2, evening.q3, evening.q4].every((value) => value.trim().length > 0);
}

function isJournalComplete(entry: MindJournalEntryRecord | null): boolean {
  return isMorningComplete(entry) && isEveningComplete(entry);
}

function taskTitleFromRule(rule: MindRuleRecord): string {
  if (rule.rule_type === "social_cutoff") {
    const time = String((rule.params_json?.time as string) ?? "12:00");
    return `No social before ${time}`;
  }
  if (rule.rule_type === "night_shutdown") {
    const time = String((rule.params_json?.time as string) ?? "22:00");
    return `No screens after ${time}`;
  }
  if (rule.rule_type === "no_short_form") {
    return "No short-form content";
  }
  return "Phone out of room during deep work";
}

function interruptionCountForSession(session: MindFocusSessionRecord): number {
  return Math.max(0, Math.round(session.interruptions_count ?? 0));
}

async function ensureMindEngineActive(): Promise<void> {
  const existing = await db.engines.filter((engine) => engine.name === "mind").first();
  if (existing?.id) {
    if (!existing.is_active) {
      await db.engines.update(existing.id, { is_active: true });
    }
    return;
  }

  const row: Omit<EngineRecord, "id"> = {
    name: "mind",
    is_active: true,
    created_at: Date.now(),
  };
  await db.engines.add(row);
}

async function upsertDayLog(
  program_id: number,
  date_iso: string,
  completed_task_ids: string[],
): Promise<MindDayLogRecord> {
  const now = Date.now();
  const existing = await getMindDayLog(program_id, date_iso);
  if (existing?.id) {
    await db.mind_day_logs.update(existing.id, {
      completed_task_ids,
      updated_at: now,
    });
    const updated = await db.mind_day_logs.get(existing.id);
    if (!updated) throw new Error("Failed to update day log");
    return updated;
  }

  const id = await db.mind_day_logs.add({
    program_id,
    date_iso,
    completed_task_ids,
    created_at: now,
    updated_at: now,
  });
  const created = await db.mind_day_logs.get(id);
  if (!created) throw new Error("Failed to create day log");
  return created;
}

async function getReviewByWeek(
  program_id: number,
  week_index: number,
): Promise<MindWeeklyReviewRecord | null> {
  const review = await db.mind_weekly_reviews
    .where("[program_id+week_index]")
    .equals([program_id, week_index])
    .first();
  return review ?? null;
}

function weekRange(program: MindProgramRecord, weekIndex: number): { weekStartIso: string; weekEndIso: string } {
  const weekStartIso = addDaysISO(program.start_date, (weekIndex - 1) * 7);
  const weekEndCandidate = addDaysISO(weekStartIso, 6);
  const endDate = getMindProgramEndDate(program);
  return {
    weekStartIso,
    weekEndIso: weekEndCandidate < endDate ? weekEndCandidate : endDate,
  };
}

function completedWeeks(program: MindProgramRecord): number {
  const elapsedDays = getElapsedDays(program);
  return Math.floor(elapsedDays / 7);
}

function getElapsedDays(program: MindProgramRecord): number {
  const today = nowDateIso();
  const endDate = getMindProgramEndDate(program);
  const windowEnd = today < endDate ? today : endDate;
  if (windowEnd < program.start_date) return 0;
  return diffDaysISO(program.start_date, windowEnd) + 1;
}

export function getMindProgramEndDate(program: MindProgramRecord): string {
  return addDaysISO(program.start_date, Math.max(0, program.duration_days - 1));
}

export function computeMindProgramDayIndex(programStartIso: string, dateIso: string): number {
  return Math.max(1, diffDaysISO(programStartIso, dateIso) + 1);
}

export function dayIndexFromProgram(program: MindProgramRecord, dateIso: string): number {
  if (dateIso < program.start_date) return 0;
  const endDate = getMindProgramEndDate(program);
  const clamped = dateIso > endDate ? endDate : dateIso;
  return computeMindProgramDayIndex(program.start_date, clamped);
}

export function isMindProgramDateInRange(program: MindProgramRecord, dateIso: string): boolean {
  const endDate = getMindProgramEndDate(program);
  return dateIso >= program.start_date && dateIso <= endDate;
}

export function canFillEveningJournal(selectedDate: string): boolean {
  const today = nowDateIso();
  if (selectedDate < today) return true;
  if (selectedDate > today) return false;
  return new Date().getHours() >= 18;
}

export async function getActiveMindProgram(): Promise<MindProgramRecord | null> {
  const programs = await db.mind_programs
    .filter((program) => program.archived_at === null || program.archived_at === undefined)
    .toArray();
  return programs.sort((first, second) => (second.created_at || 0) - (first.created_at || 0))[0] ?? null;
}

export async function getMindProgramById(program_id: number): Promise<MindProgramRecord | null> {
  return (await db.mind_programs.get(program_id)) ?? null;
}

export async function createMindProgram(input: {
  main_issue: MindIssue;
  deep_work_target_min: number;
  social_cutoff_time?: string | null;
  night_shutdown_time?: string | null;
  duration_days: number;
  no_short_form?: boolean;
  phone_away_deepwork?: boolean;
}): Promise<MindProgramRecord> {
  const active = await getActiveMindProgram();
  if (active?.id) throw new Error("ACTIVE_PROGRAM_EXISTS");

  const now = Date.now();
  const start_date = nowDateIso();
  const duration_days = Math.max(1, Math.round(input.duration_days));
  const deep_work_target_min = Math.max(30, Math.min(180, Math.round(input.deep_work_target_min)));
  const social_cutoff_time = normalizeOptionalTime(input.social_cutoff_time);
  const night_shutdown_time = normalizeOptionalTime(input.night_shutdown_time);

  const programId = await db.transaction(
    "rw",
    db.mind_programs,
    db.mind_tasks,
    db.mind_rules,
    db.engines,
    async () => {
      const current = await getActiveMindProgram();
      if (current?.id) throw new Error("ACTIVE_PROGRAM_EXISTS");

      const id = await db.mind_programs.add({
        start_date,
        duration_days,
        main_issue: input.main_issue,
        deep_work_target_min,
        social_cutoff_time,
        night_shutdown_time,
        created_at: now,
        archived_at: null,
      });

      const rules: Array<Omit<MindRuleRecord, "id">> = [];
      if (social_cutoff_time) {
        rules.push({
          program_id: id,
          rule_type: "social_cutoff",
          params_json: { time: social_cutoff_time },
          active: true,
          created_at: now,
        });
      }
      if (night_shutdown_time) {
        rules.push({
          program_id: id,
          rule_type: "night_shutdown",
          params_json: { time: night_shutdown_time },
          active: true,
          created_at: now + 1,
        });
      }
      if (input.no_short_form) {
        rules.push({
          program_id: id,
          rule_type: "no_short_form",
          params_json: {},
          active: true,
          created_at: now + 2,
        });
      }
      if (input.phone_away_deepwork) {
        rules.push({
          program_id: id,
          rule_type: "phone_away_deepwork",
          params_json: {},
          active: true,
          created_at: now + 3,
        });
      }
      if (rules.length > 0) {
        await db.mind_rules.bulkAdd(rules);
      }

      const ruleRows = rules.map((rule, index) => ({ ...rule, created_at: rule.created_at + index }));
      const tasks: Array<Omit<MindTaskRecord, "id">> = [
        {
          program_id: id,
          title: "Daily Journal (Morning + Evening)",
          category: "journaling",
          locked: true,
          is_active: true,
          created_at: now,
        },
        {
          program_id: id,
          title: `Deep Work: ${deep_work_target_min} min`,
          category: "deep_work",
          locked: true,
          is_active: true,
          created_at: now + 1,
        },
        ...ruleRows.map((rule, index) => ({
          program_id: id,
          title: taskTitleFromRule(rule),
          category: "discipline" as const,
          locked: true,
          is_active: true,
          created_at: now + 2 + index,
        })),
      ];

      await db.mind_tasks.bulkAdd(tasks);
      await ensureMindEngineActive();
      return id;
    },
  );

  const created = await db.mind_programs.get(programId);
  if (!created) throw new Error("Failed to create mind program");
  return created;
}

export async function archiveMindProgram(program_id: number): Promise<void> {
  const program = await db.mind_programs.get(program_id);
  if (!program) throw new Error("Program not found");
  await db.mind_programs.update(program_id, { archived_at: Date.now() });
}

export async function extendMindProgram(program_id: number, extraDays: number): Promise<MindProgramRecord> {
  const program = await db.mind_programs.get(program_id);
  if (!program || program.archived_at !== null) {
    throw new Error("Program not active");
  }
  const extension = Math.max(1, Math.round(extraDays));
  await db.mind_programs.update(program_id, {
    duration_days: program.duration_days + extension,
  });
  const updated = await db.mind_programs.get(program_id);
  if (!updated) throw new Error("Failed to extend program");
  return updated;
}

export async function hardResetMindProgram(program_id: number): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    await db.mind_day_logs.where("program_id").equals(program_id).delete();
    await db.mind_journal_entries.where("program_id").equals(program_id).delete();
    await db.mind_focus_sessions.where("program_id").equals(program_id).delete();
    await db.mind_rules.where("program_id").equals(program_id).delete();
    await db.mind_rule_violations.where("program_id").equals(program_id).delete();
    await db.mind_weekly_reviews.where("program_id").equals(program_id).delete();
    await db.mind_tasks.where("program_id").equals(program_id).delete();
    await db.mind_programs.delete(program_id);
  });
}

export async function listMindTasks(program_id: number): Promise<MindTaskRecord[]> {
  const tasks = await db.mind_tasks.where("program_id").equals(program_id).toArray();
  return tasks.sort((first, second) => {
    if (isTaskActive(first) !== isTaskActive(second)) return isTaskActive(first) ? -1 : 1;
    if (first.locked !== second.locked) return first.locked ? -1 : 1;
    if (first.category !== second.category) return first.category.localeCompare(second.category);
    return first.title.localeCompare(second.title);
  });
}

export async function listMindRules(program_id: number): Promise<MindRuleRecord[]> {
  const rows = await db.mind_rules.where("program_id").equals(program_id).toArray();
  return rows.sort((first, second) => (first.created_at || 0) - (second.created_at || 0));
}

export async function getMindRuleViolationsForDate(
  program_id: number,
  date_iso: string,
): Promise<MindRuleViolationRecord[]> {
  const rows = await db.mind_rule_violations.where("program_id").equals(program_id).toArray();
  return rows
    .filter((row) => row.date_iso === date_iso)
    .sort((first, second) => first.time_iso.localeCompare(second.time_iso));
}

export async function logMindRuleViolation(input: {
  program_id: number;
  date_iso: string;
  rule_type: MindRuleType;
  time_iso?: string;
  note?: string | null;
}): Promise<MindRuleViolationRecord> {
  if (!isIsoDate(input.date_iso)) throw new Error("Date must be YYYY-MM-DD");
  const now = Date.now();
  const time_iso = input.time_iso ? new Date(input.time_iso).toISOString() : new Date().toISOString();

  const id = await db.mind_rule_violations.add({
    program_id: input.program_id,
    date_iso: input.date_iso,
    rule_type: input.rule_type,
    time_iso,
    note: input.note?.trim() || null,
    created_at: now,
  });

  await evaluateMindAutoCompletions(input.program_id, input.date_iso);

  const created = await db.mind_rule_violations.get(id);
  if (!created) throw new Error("Failed to log violation");
  return created;
}

export async function getMindDayLog(program_id: number, date_iso: string): Promise<MindDayLogRecord | null> {
  if (!isIsoDate(date_iso)) throw new Error("Date must be YYYY-MM-DD");
  const row = await db.mind_day_logs.where("[program_id+date_iso]").equals([program_id, date_iso]).first();
  return row ?? null;
}

export async function getMindJournal(program_id: number, date_iso: string): Promise<MindJournalEntryRecord | null> {
  if (!isIsoDate(date_iso)) throw new Error("Date must be YYYY-MM-DD");
  const row = await db.mind_journal_entries
    .where("[program_id+date_iso]")
    .equals([program_id, date_iso])
    .first();
  return row ?? null;
}

export async function getMindJournalEntry(
  program_id: number,
  date_iso: string,
): Promise<MindJournalEntryRecord | null> {
  return getMindJournal(program_id, date_iso);
}

export async function getMindFocusSessionsForDate(
  program_id: number,
  date_iso: string,
): Promise<MindFocusSessionRecord[]> {
  if (!isIsoDate(date_iso)) throw new Error("Date must be YYYY-MM-DD");
  const rows = await db.mind_focus_sessions.where("program_id").equals(program_id).toArray();
  return rows
    .filter((row) => row.date_iso === date_iso)
    .sort((first, second) => first.start_time_iso.localeCompare(second.start_time_iso));
}

export async function getMindFocusTotal(program_id: number, date_iso: string): Promise<number> {
  const rows = await getMindFocusSessionsForDate(program_id, date_iso);
  return rows.reduce((sum, row) => sum + Math.max(0, row.duration_minutes || 0), 0);
}

export async function getMindFocusMinutesForDate(program_id: number, date_iso: string): Promise<number> {
  return getMindFocusTotal(program_id, date_iso);
}

export async function setMindTaskCompletion(
  program_id: number,
  date_iso: string,
  task_id: number,
  completed: boolean,
): Promise<MindDayLogRecord> {
  const task = await db.mind_tasks.get(task_id);
  if (!task || task.program_id !== program_id || !isTaskActive(task)) {
    throw new Error("Task not found");
  }

  const dayLog = await getMindDayLog(program_id, date_iso);
  const set = completionSet(dayLog);
  if (completed) {
    set.add(String(task_id));
  } else {
    set.delete(String(task_id));
  }

  return upsertDayLog(program_id, date_iso, [...set]);
}

export async function toggleMindTaskForDate(
  program_id: number,
  date_iso: string,
  task_id: number,
): Promise<MindDayLogRecord> {
  const dayLog = await getMindDayLog(program_id, date_iso);
  const key = String(task_id);
  const set = completionSet(dayLog);
  return setMindTaskCompletion(program_id, date_iso, task_id, !set.has(key));
}

export async function upsertMindMorningJournal(
  program_id: number,
  date_iso: string,
  payload: MindMorningJournal,
): Promise<MindJournalEntryRecord> {
  const morning_json: MindMorningJournal = {
    q1: normalizeText(payload.q1),
    q2: normalizeText(payload.q2),
    q3: normalizeText(payload.q3),
  };

  if (!morning_json.q1 || !morning_json.q2 || !morning_json.q3) {
    throw new Error("All morning journal fields are required");
  }

  const now = Date.now();
  const existing = await getMindJournal(program_id, date_iso);

  if (existing?.id) {
    await db.mind_journal_entries.update(existing.id, { morning_json, updated_at: now });
    await evaluateMindAutoCompletions(program_id, date_iso);
    const updated = await db.mind_journal_entries.get(existing.id);
    if (!updated) throw new Error("Failed to update morning journal");
    return updated;
  }

  const id = await db.mind_journal_entries.add({
    program_id,
    date_iso,
    morning_json,
    evening_json: null,
    created_at: now,
    updated_at: now,
  });

  await evaluateMindAutoCompletions(program_id, date_iso);

  const created = await db.mind_journal_entries.get(id);
  if (!created) throw new Error("Failed to save morning journal");
  return created;
}

export async function upsertMindEveningJournal(
  program_id: number,
  date_iso: string,
  payload: MindEveningJournal,
): Promise<MindJournalEntryRecord> {
  const evening_json: MindEveningJournal = {
    q1: normalizeText(payload.q1),
    q2: normalizeText(payload.q2),
    q3: normalizeText(payload.q3),
    q4: normalizeText(payload.q4),
  };

  if (!evening_json.q1 || !evening_json.q2 || !evening_json.q3 || !evening_json.q4) {
    throw new Error("All evening journal fields are required");
  }

  const now = Date.now();
  const existing = await getMindJournal(program_id, date_iso);

  if (existing?.id) {
    await db.mind_journal_entries.update(existing.id, { evening_json, updated_at: now });
    await evaluateMindAutoCompletions(program_id, date_iso);
    const updated = await db.mind_journal_entries.get(existing.id);
    if (!updated) throw new Error("Failed to update evening journal");
    return updated;
  }

  const id = await db.mind_journal_entries.add({
    program_id,
    date_iso,
    morning_json: null,
    evening_json,
    created_at: now,
    updated_at: now,
  });

  await evaluateMindAutoCompletions(program_id, date_iso);

  const created = await db.mind_journal_entries.get(id);
  if (!created) throw new Error("Failed to save evening journal");
  return created;
}

export async function addMindFocusSession(input: {
  program_id: number;
  date_iso?: string;
  start_time_iso: string;
  end_time_iso: string;
  duration_minutes: number;
  interrupted: boolean;
  interruptions_count?: number;
  interruptions_json?: Array<{ at_minute: number; reason: MindInterruptionReason }>;
}): Promise<MindFocusSessionRecord> {
  const program = await getMindProgramById(input.program_id);
  if (!program || program.archived_at !== null) {
    throw new Error("No active mind program");
  }

  const start = new Date(input.start_time_iso);
  const end = new Date(input.end_time_iso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid focus session timestamps");
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("Focus session end must be after start");
  }

  const date_iso = input.date_iso ?? toISODateLocal(start);
  const duration_minutes = Math.max(1, Math.round(input.duration_minutes));
  const interruptions_count = Math.max(0, Math.round(input.interruptions_count ?? 0));

  const id = await db.mind_focus_sessions.add({
    program_id: input.program_id,
    date_iso,
    start_time_iso: start.toISOString(),
    end_time_iso: end.toISOString(),
    duration_minutes,
    interrupted: input.interrupted,
    interruptions_count,
    interruptions_json: input.interruptions_json ?? [],
  });

  await evaluateMindAutoCompletions(input.program_id, date_iso);

  const created = await db.mind_focus_sessions.get(id);
  if (!created) throw new Error("Failed to create focus session");
  return created;
}

export async function evaluateMindAutoCompletions(
  program_id: number,
  date_iso: string,
): Promise<MindDayLogRecord> {
  const [program, tasks, rules, dayLog, journal, focusMinutes, violations] = await Promise.all([
    getMindProgramById(program_id),
    listMindTasks(program_id),
    listMindRules(program_id),
    getMindDayLog(program_id, date_iso),
    getMindJournal(program_id, date_iso),
    getMindFocusTotal(program_id, date_iso),
    getMindRuleViolationsForDate(program_id, date_iso),
  ]);

  if (!program || program.archived_at !== null) {
    throw new Error("No active mind program");
  }

  const activeRules = rules.filter((rule) => rule.active);
  const violationsByRule = new Map<MindRuleType, number>();
  for (const violation of violations) {
    const count = violationsByRule.get(violation.rule_type) ?? 0;
    violationsByRule.set(violation.rule_type, count + 1);
  }

  const taskRuleMap = new Map<string, MindRuleType>();
  for (const rule of activeRules) {
    taskRuleMap.set(taskTitleFromRule(rule), rule.rule_type);
  }

  const set = completionSet(dayLog);
  const journalComplete = isJournalComplete(journal);
  const deepWorkComplete = focusMinutes >= program.deep_work_target_min;

  for (const task of tasks) {
    if (!task.id || !isTaskActive(task)) continue;
    const key = String(task.id);

    if (task.category === "journaling") {
      if (journalComplete) set.add(key);
      else set.delete(key);
      continue;
    }

    if (task.category === "deep_work") {
      if (deepWorkComplete) set.add(key);
      else set.delete(key);
      continue;
    }

    if (task.category === "discipline") {
      const mappedRule = taskRuleMap.get(task.title);
      if (mappedRule) {
        const violationsForRule = violationsByRule.get(mappedRule) ?? 0;
        if (violationsForRule === 0) set.add(key);
        else set.delete(key);
      }
    }
  }

  return upsertDayLog(program_id, date_iso, [...set]);
}

export async function getMindCompletionForDate(
  program_id: number,
  date_iso: string,
): Promise<{ doneCount: number; totalCount: number; percent: number; completedTaskIds: string[] }> {
  const [tasks, dayLog] = await Promise.all([listMindTasks(program_id), getMindDayLog(program_id, date_iso)]);
  const activeTaskIds = tasks
    .filter((task) => isTaskActive(task) && task.id)
    .map((task) => String(task.id));
  const doneSet = completionSet(dayLog);
  const doneCount = activeTaskIds.filter((taskId) => doneSet.has(taskId)).length;
  const totalCount = activeTaskIds.length;
  const percent = totalCount > 0 ? clampPercent((doneCount / totalCount) * 100) : 0;

  return {
    doneCount,
    totalCount,
    percent,
    completedTaskIds: [...doneSet],
  };
}

export async function getMindRangeSummary(
  program_id: number,
  start_iso: string,
  end_iso: string,
): Promise<
  Array<{
    dateIso: string;
    percent: number;
    completedCount: number;
    totalCount: number;
    focusMinutes: number;
    hasJournal: boolean;
    archivedCompletedCount: number;
    violationsCount: number;
    interruptionsTotal: number;
    focusQuality: number;
  }>
> {
  if (!isIsoDate(start_iso) || !isIsoDate(end_iso)) {
    throw new Error("Dates must be YYYY-MM-DD");
  }
  if (end_iso < start_iso) return [];

  const [tasks, dayLogs, journals, sessions, violations] = await Promise.all([
    listMindTasks(program_id),
    db.mind_day_logs.where("program_id").equals(program_id).toArray(),
    db.mind_journal_entries.where("program_id").equals(program_id).toArray(),
    db.mind_focus_sessions.where("program_id").equals(program_id).toArray(),
    db.mind_rule_violations.where("program_id").equals(program_id).toArray(),
  ]);

  const activeTaskIds = new Set(
    tasks.filter((task) => isTaskActive(task) && task.id).map((task) => String(task.id)),
  );
  const totalCount = activeTaskIds.size;

  const dayLogMap = new Map(dayLogs.map((row) => [row.date_iso, row.completed_task_ids] as const));
  const journalMap = new Map(journals.map((row) => [row.date_iso, row] as const));

  const focusMinutesByDate = new Map<string, number>();
  const interruptionsByDate = new Map<string, number>();
  for (const session of sessions) {
    if (session.date_iso < start_iso || session.date_iso > end_iso) continue;
    focusMinutesByDate.set(
      session.date_iso,
      (focusMinutesByDate.get(session.date_iso) ?? 0) + Math.max(0, session.duration_minutes || 0),
    );
    interruptionsByDate.set(
      session.date_iso,
      (interruptionsByDate.get(session.date_iso) ?? 0) + interruptionCountForSession(session),
    );
  }

  const violationsByDate = new Map<string, number>();
  for (const violation of violations) {
    if (violation.date_iso < start_iso || violation.date_iso > end_iso) continue;
    violationsByDate.set(violation.date_iso, (violationsByDate.get(violation.date_iso) ?? 0) + 1);
  }

  return eachDate(start_iso, end_iso).map((dateIso) => {
    const completed = dayLogMap.get(dateIso) ?? [];
    const completedCount = completed.filter((taskId) => activeTaskIds.has(taskId)).length;
    const archivedCompletedCount = Math.max(0, completed.length - completedCount);
    const percent = totalCount > 0 ? clampPercent((completedCount / totalCount) * 100) : 0;
    const hasJournal = isJournalComplete(journalMap.get(dateIso) ?? null);
    const focusMinutes = focusMinutesByDate.get(dateIso) ?? 0;
    const interruptionsTotal = interruptionsByDate.get(dateIso) ?? 0;
    const focusQuality = clampPercent(100 - interruptionsTotal * 12);

    return {
      dateIso,
      percent,
      completedCount,
      totalCount,
      focusMinutes,
      hasJournal,
      archivedCompletedCount,
      violationsCount: violationsByDate.get(dateIso) ?? 0,
      interruptionsTotal,
      focusQuality,
    };
  });
}

export async function getMindConsistencyForRange(
  program_id: number,
  start_date: string,
  end_date: string,
): Promise<Array<{ date: string; percent: number; doneCount: number; totalCount: number }>> {
  const rows = await getMindRangeSummary(program_id, start_date, end_date);
  return rows.map((row) => ({
    date: row.dateIso,
    percent: row.percent,
    doneCount: row.completedCount,
    totalCount: row.totalCount,
  }));
}

export function generateAdaptiveMindFeedback(input: {
  percentConsistency: number;
  focusMinutes: number;
  targetMinutes: number;
  interruptionsTotal: number;
  violationsCount: number;
  journalComplete: boolean;
}): { title: string; body: string; mentalState: "stable" | "distracted" | "overstimulated" | "avoiding" } {
  const {
    percentConsistency,
    focusMinutes,
    targetMinutes,
    interruptionsTotal,
    violationsCount,
    journalComplete,
  } = input;

  const safeTarget = Math.max(1, targetMinutes);
  const focusRatio = focusMinutes / safeTarget;

  if (!journalComplete && violationsCount > 0) {
    return {
      mentalState: "avoiding",
      title: "Mental state: Avoiding",
      body: `You skipped reflection and logged ${violationsCount} violation${violationsCount === 1 ? "" : "s"} today. Write both journal blocks tonight, then start tomorrow with one protected 25-minute block before any feeds.`,
    };
  }

  if (interruptionsTotal >= 4 || violationsCount >= 3) {
    return {
      mentalState: "overstimulated",
      title: "Mental state: Overstimulated",
      body: `You logged ${interruptionsTotal} interruption${interruptionsTotal === 1 ? "" : "s"} and ${violationsCount} rule violation${violationsCount === 1 ? "" : "s"}. Reduce stimulation tomorrow: phone out of reach and one hard social cutoff window.`,
    };
  }

  if (focusRatio < 0.75 && interruptionsTotal > 0) {
    return {
      mentalState: "distracted",
      title: "Mental state: Distracted",
      body: `Focus landed at ${focusMinutes}/${safeTarget} minutes with ${interruptionsTotal} interruption${interruptionsTotal === 1 ? "" : "s"}. Keep tomorrow simple: one uninterrupted block first, then react to everything else.`,
    };
  }

  if (!journalComplete) {
    return {
      mentalState: "distracted",
      title: "Mental state: Distracted",
      body: "You moved, but you didn’t close the loop. Finish journaling tonight so tomorrow starts with a clear target instead of mental noise.",
    };
  }

  if (violationsCount >= 2) {
    return {
      mentalState: "distracted",
      title: "Mental state: Distracted",
      body: `Attention leaked through ${violationsCount} violation${violationsCount === 1 ? "" : "s"}. Keep one visible rule card tomorrow and protect it for the first half of your day.`,
    };
  }

  if (focusMinutes >= targetMinutes && interruptionsTotal >= 3) {
    return {
      mentalState: "overstimulated",
      title: "Mental state: Overstimulated",
      body: `You hit focus target (${focusMinutes}/${safeTarget}) but bled attention (${interruptionsTotal} interruptions). Keep the workload, reduce inputs: no notifications during block one.`,
    };
  }

  if (percentConsistency >= 80) {
    return {
      mentalState: "stable",
      title: "Mental state: Stable",
      body: `You completed ${Math.round(percentConsistency)}% with low friction. Keep it boring and repeat tomorrow — same start time, same first block, same rules.`,
    };
  }

  if (percentConsistency >= 40) {
    return {
      mentalState: "distracted",
      title: "Mental state: Distracted",
      body: `You showed partial control (${Math.round(percentConsistency)}%). Tomorrow, do your hardest task first and protect one uninterrupted deep-work block.`,
    };
  }

  return {
    mentalState: "avoiding",
    title: "Mental state: Avoiding",
    body: "You drifted today. That’s data, not identity. Reset tonight with a short journal and start tomorrow with a single 25-minute block before any inputs.",
  };
}

export function generateDailyMindFeedback(percent: number): string {
  return generateAdaptiveMindFeedback({
    percentConsistency: percent,
    focusMinutes: 0,
    targetMinutes: 1,
    interruptionsTotal: 0,
    violationsCount: 0,
    journalComplete: percent > 0,
  }).body;
}

export async function getMindProgramProgress(program_id: number): Promise<{
  dayIndex: number;
  totalDays: number;
  consistency: number;
  startDate: string;
  endDate: string;
}> {
  const program = await getMindProgramById(program_id);
  if (!program) throw new Error("Mind program not found");

  const startDate = program.start_date;
  const endDate = getMindProgramEndDate(program);
  const today = nowDateIso();
  const windowEnd = today < endDate ? today : endDate;

  if (windowEnd < startDate) {
    return { dayIndex: 0, totalDays: program.duration_days, consistency: 0, startDate, endDate };
  }

  const summary = await getMindRangeSummary(program_id, startDate, windowEnd);
  return {
    dayIndex: summary.length,
    totalDays: program.duration_days,
    consistency: summary.length > 0 ? clampPercent(average(summary.map((row) => row.percent))) : 0,
    startDate,
    endDate,
  };
}

export async function getMindFocusStats(program_id: number, rangeDays = 7): Promise<{
  todayMinutes: number;
  todaySessions: MindFocusSessionRecord[];
  daily: Array<{ date: string; minutes: number; sessions: number; interruptions: number }>;
}> {
  const today = nowDateIso();
  const start = addDaysISO(today, -(Math.max(1, Math.round(rangeDays)) - 1));
  const dates = eachDate(start, today);

  const sessions = await db.mind_focus_sessions.where("program_id").equals(program_id).toArray();
  const inRange = sessions.filter((row) => row.date_iso >= start && row.date_iso <= today);

  return {
    todayMinutes: inRange
      .filter((row) => row.date_iso === today)
      .reduce((sum, row) => sum + Math.max(0, row.duration_minutes || 0), 0),
    todaySessions: inRange
      .filter((row) => row.date_iso === today)
      .sort((first, second) => first.start_time_iso.localeCompare(second.start_time_iso)),
    daily: dates.map((date) => {
      const rows = inRange.filter((row) => row.date_iso === date);
      return {
        date,
        minutes: rows.reduce((sum, row) => sum + Math.max(0, row.duration_minutes || 0), 0),
        sessions: rows.length,
        interruptions: rows.reduce((sum, row) => sum + interruptionCountForSession(row), 0),
      };
    }),
  };
}

export async function getMindDailyState(program_id: number, date_iso: string): Promise<{
  tasks: MindTaskRecord[];
  dayLog: MindDayLogRecord | null;
  journal: MindJournalEntryRecord | null;
  focusMinutes: number;
  interruptionsTotal: number;
  violationsCount: number;
  focusQuality: number;
  journalComplete: boolean;
  doneCount: number;
  totalCount: number;
  percent: number;
  feedback: string;
  feedbackTitle: string;
  mentalState: "stable" | "distracted" | "overstimulated" | "avoiding";
}> {
  const [program, tasks, dayLog, journal, focusSessions, violations, completion] = await Promise.all([
    getMindProgramById(program_id),
    listMindTasks(program_id),
    getMindDayLog(program_id, date_iso),
    getMindJournal(program_id, date_iso),
    getMindFocusSessionsForDate(program_id, date_iso),
    getMindRuleViolationsForDate(program_id, date_iso),
    getMindCompletionForDate(program_id, date_iso),
  ]);

  const focusMinutes = focusSessions.reduce((sum, row) => sum + Math.max(0, row.duration_minutes || 0), 0);
  const interruptionsTotal = focusSessions.reduce((sum, row) => sum + interruptionCountForSession(row), 0);
  const violationsCount = violations.length;
  const focusQuality = clampPercent(100 - interruptionsTotal * 12);
  const journalComplete = isJournalComplete(journal);

  const adaptive = generateAdaptiveMindFeedback({
    percentConsistency: completion.percent,
    focusMinutes,
    targetMinutes: program?.deep_work_target_min ?? 1,
    interruptionsTotal,
    violationsCount,
    journalComplete,
  });

  return {
    tasks,
    dayLog,
    journal,
    focusMinutes,
    interruptionsTotal,
    violationsCount,
    focusQuality,
    journalComplete,
    doneCount: completion.doneCount,
    totalCount: completion.totalCount,
    percent: completion.percent,
    feedback: adaptive.body,
    feedbackTitle: adaptive.title,
    mentalState: adaptive.mentalState,
  };
}

export async function updateMindRuleViolationNote(
  violation_id: number,
  note: string | null,
): Promise<MindRuleViolationRecord> {
  const existing = await db.mind_rule_violations.get(violation_id);
  if (!existing) throw new Error("Violation not found");
  await db.mind_rule_violations.update(violation_id, {
    note: note?.trim() || null,
  });
  const updated = await db.mind_rule_violations.get(violation_id);
  if (!updated) throw new Error("Violation not found");
  return updated;
}

export async function getMindActiveProgramView(): Promise<{
  program: MindProgramRecord;
  tasks: MindTaskRecord[];
  progress: { dayIndex: number; totalDays: number; consistency: number; startDate: string; endDate: string };
} | null> {
  const program = await getActiveMindProgram();
  if (!program?.id) return null;

  const [tasks, progress] = await Promise.all([listMindTasks(program.id), getMindProgramProgress(program.id)]);
  return { program, tasks, progress };
}

export function generateWeeklyMindFeedback(input: {
  avg_consistency: number;
  total_focus_minutes: number;
  journal_days_completed: number;
  violations_total?: number;
  interruptions_total?: number;
  days: number;
}): string {
  const {
    avg_consistency,
    total_focus_minutes,
    journal_days_completed,
    violations_total = 0,
    interruptions_total = 0,
    days,
  } = input;

  const acknowledge =
    avg_consistency >= 80
      ? "You built a stable week."
      : avg_consistency >= 45
        ? "You showed effort, but execution was uneven."
        : "This week was unstable, and that’s useful information.";

  const drift =
    violations_total > 3
      ? "Rule violations were frequent, which likely drove attention drift."
      : interruptions_total > 8
        ? "Interruptions were high; attention fragmented even when you sat down to work."
        : journal_days_completed < Math.ceil(days * 0.6)
          ? "Journaling was inconsistent, so planning likely stayed in your head."
          : "Your inputs and reflection cadence were mostly controlled.";

  const recommendation =
    total_focus_minutes < days * 30
      ? "Next week, lock one 30-minute deep-work block before checking messages."
      : "Next week, protect transitions: 3 slow breaths, then single-task start.";

  return `${acknowledge} ${drift} ${recommendation}`;
}

export async function listMindWeeklyReviews(program_id: number): Promise<MindWeeklyReviewRecord[]> {
  const reviews = await db.mind_weekly_reviews.where("program_id").equals(program_id).toArray();
  return reviews.sort((first, second) => second.week_index - first.week_index);
}

export async function getPendingWeeklyReview(program_id: number): Promise<
  | {
      week_index: number;
      week_start_iso: string;
      week_end_iso: string;
    }
  | null
> {
  const program = await getMindProgramById(program_id);
  if (!program) return null;

  const completed = completedWeeks(program);
  if (completed <= 0) return null;

  for (let week = 1; week <= completed; week += 1) {
    const existing = await getReviewByWeek(program_id, week);
    if (!existing) {
      const range = weekRange(program, week);
      return {
        week_index: week,
        week_start_iso: range.weekStartIso,
        week_end_iso: range.weekEndIso,
      };
    }
  }

  return null;
}

export async function saveMindWeeklyReview(input: {
  program_id: number;
  week_index: number;
  reflection_json: MindWeeklyReviewReflection;
}): Promise<MindWeeklyReviewRecord> {
  const program = await getMindProgramById(input.program_id);
  if (!program) throw new Error("Program not found");

  const maxWeek = completedWeeks(program);
  if (input.week_index < 1 || input.week_index > maxWeek) {
    throw new Error("WEEK_NOT_READY");
  }

  const reflection_json = normalizeReflection(input.reflection_json);
  if (!reflection_json.q1 || !reflection_json.q2 || !reflection_json.q3 || !reflection_json.q4) {
    throw new Error("All weekly reflection fields are required");
  }

  const { weekStartIso, weekEndIso } = weekRange(program, input.week_index);
  const summary = await getMindRangeSummary(input.program_id, weekStartIso, weekEndIso);
  const avg_consistency = summary.length > 0 ? clampPercent(average(summary.map((row) => row.percent))) : 0;
  const total_focus_minutes = summary.reduce((sum, row) => sum + row.focusMinutes, 0);
  const journal_days_completed = summary.filter((row) => row.hasJournal).length;
  const violations_total = summary.reduce((sum, row) => sum + row.violationsCount, 0);
  const interruptions_total = summary.reduce((sum, row) => sum + row.interruptionsTotal, 0);

  let best_day_iso: string | null = null;
  let worst_day_iso: string | null = null;
  for (const day of summary) {
    if (!best_day_iso || day.percent > (summary.find((row) => row.dateIso === best_day_iso)?.percent ?? -1)) {
      best_day_iso = day.dateIso;
    }
    if (!worst_day_iso || day.percent < (summary.find((row) => row.dateIso === worst_day_iso)?.percent ?? 101)) {
      worst_day_iso = day.dateIso;
    }
  }

  const feedback_text = generateWeeklyMindFeedback({
    avg_consistency,
    total_focus_minutes,
    journal_days_completed,
    violations_total,
    interruptions_total,
    days: summary.length,
  });

  const now = Date.now();
  const existing = await getReviewByWeek(input.program_id, input.week_index);

  if (existing?.id) {
    await db.mind_weekly_reviews.update(existing.id, {
      week_start_iso: weekStartIso,
      week_end_iso: weekEndIso,
      avg_consistency,
      total_focus_minutes,
      journal_days_completed,
      best_day_iso,
      worst_day_iso,
      reflection_json,
      feedback_text,
      updated_at: now,
    });
    const updated = await db.mind_weekly_reviews.get(existing.id);
    if (!updated) throw new Error("Failed to update weekly review");
    return updated;
  }

  const id = await db.mind_weekly_reviews.add({
    program_id: input.program_id,
    week_index: input.week_index,
    week_start_iso: weekStartIso,
    week_end_iso: weekEndIso,
    avg_consistency,
    total_focus_minutes,
    journal_days_completed,
    best_day_iso,
    worst_day_iso,
    reflection_json,
    feedback_text,
    created_at: now,
    updated_at: now,
  });

  const created = await db.mind_weekly_reviews.get(id);
  if (!created) throw new Error("Failed to create weekly review");
  return created;
}

export async function clearArchivedMindPrograms(): Promise<void> {
  const archived = await db.mind_programs.filter((program) => typeof program.archived_at === "number").toArray();
  const archivedIds = archived
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");
  if (archivedIds.length === 0) return;

  await db.transaction("rw", db.tables, async () => {
    for (const programId of archivedIds) {
      await hardResetMindProgram(programId);
    }
  });
}

export function fromISOToLocalDate(iso: string): Date {
  return parseDateOnly(iso);
}

export function minutesToHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function daysBetweenInclusive(startIso: string, endIso: string): number {
  if (endIso < startIso) return 0;
  return diffDaysISO(startIso, endIso) + 1;
}

export function dateLabel(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function nowEpochMs(): number {
  return Date.now();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function truncateToDayStartMs(iso: string): number {
  return parseDateOnly(iso).getTime();
}

export function shiftISO(iso: string, offsetDays: number): string {
  return addDaysISO(iso, offsetDays);
}

export function parseDurationMinutes(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / (60 * 1000)));
}

export function elapsedSecondsFrom(startEpochMs: number): number {
  return Math.max(0, Math.floor((Date.now() - startEpochMs) / 1000));
}

export function addMsToIso(iso: string, deltaMs: number): string {
  return new Date(new Date(iso).getTime() + deltaMs).toISOString();
}

export function midnightISOForDate(dateIso: string): string {
  const date = parseDateOnly(dateIso);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function endOfDayISOForDate(dateIso: string): string {
  const date = parseDateOnly(dateIso);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function isDatePast(dateIso: string): boolean {
  return dateIso < nowDateIso();
}

export function isDateFuture(dateIso: string): boolean {
  return dateIso > nowDateIso();
}

export function isDateToday(dateIso: string): boolean {
  return dateIso === nowDateIso();
}

export function dateDistanceFromToday(dateIso: string): number {
  return diffDaysISO(nowDateIso(), dateIso);
}

export function unixDayFromIso(dateIso: string): number {
  return Math.floor(parseDateOnly(dateIso).getTime() / MS_PER_DAY);
}

export function isoFromUnixDay(unixDay: number): string {
  return toISODateLocal(new Date(unixDay * MS_PER_DAY));
}
