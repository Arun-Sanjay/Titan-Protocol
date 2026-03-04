import { db, type MindPomodoroDaily, type MindPomodoroSettings } from "./db";
import { assertDateISO, todayISO } from "./date";
import { assertIDBKey } from "./idb_debug";

const DEFAULT_SETTINGS: MindPomodoroSettings = {
  id: "settings",
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfter: 4,
  dailyTarget: 4,
  updatedAt: new Date().toISOString(),
};

export async function getPomodoroSettings(): Promise<MindPomodoroSettings> {
  const existing = await db.pomodoro_goal_settings.get("settings");
  return existing ?? DEFAULT_SETTINGS;
}

export async function savePomodoroSettings(
  partial: Partial<Omit<MindPomodoroSettings, "id" | "updatedAt">>,
): Promise<MindPomodoroSettings> {
  const current = await getPomodoroSettings();
  const next: MindPomodoroSettings = {
    ...current,
    ...partial,
    id: "settings",
    updatedAt: new Date().toISOString(),
  };
  await db.pomodoro_goal_settings.put(next);
  return next;
}

export async function getPomodoroDay(dateISO: string): Promise<MindPomodoroDaily> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  assertIDBKey("pomodoro.daily.get(dateISO)", safeDate);
  const existing = await db.pomodoro_daily.get(safeDate);
  return (
    existing ?? {
      dateISO: safeDate,
      completed: 0,
      updatedAt: new Date().toISOString(),
    }
  );
}

export async function setPomodoroDayCompleted(dateISO: string, completed: number) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const next: MindPomodoroDaily = {
    dateISO: safeDate,
    completed: Math.max(0, completed),
    updatedAt: new Date().toISOString(),
  };
  await db.pomodoro_daily.put(next);
  return next;
}

export async function incrementPomodoroDayCompleted(dateISO: string, delta = 1) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const existing = await db.pomodoro_daily.get(safeDate);
  const nextCount = Math.max(0, (existing?.completed ?? 0) + delta);
  const next: MindPomodoroDaily = {
    dateISO: safeDate,
    completed: nextCount,
    updatedAt: new Date().toISOString(),
  };
  await db.pomodoro_daily.put(next);
  return next;
}
