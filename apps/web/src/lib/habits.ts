import { db, type Habit, type HabitLog } from "./db";
import { todayISO } from "./date";

// ---- CRUD ----

export async function listHabits(): Promise<Habit[]> {
  return db.habits.orderBy("createdAt").toArray();
}

export async function addHabit(
  title: string,
  engine: Habit["engine"],
  icon: string,
): Promise<number> {
  return db.habits.add({
    title,
    engine,
    icon,
    createdAt: Date.now(),
  });
}

export async function deleteHabit(habitId: number): Promise<void> {
  await db.transaction("rw", db.habits, db.habit_logs, async () => {
    await db.habit_logs.where("habitId").equals(habitId).delete();
    await db.habits.delete(habitId);
  });
}

// ---- Toggle ----

export async function toggleHabitForDate(
  habitId: number,
  dateKey: string,
): Promise<void> {
  const existing = await db.habit_logs
    .where("[habitId+dateKey]")
    .equals([habitId, dateKey])
    .first();

  if (existing) {
    await db.habit_logs.update(existing.id!, {
      completed: !existing.completed,
    });
  } else {
    await db.habit_logs.add({
      habitId,
      dateKey,
      completed: true,
    });
  }
}

// ---- Queries ----

export async function getHabitLogsForRange(
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  return db.habit_logs
    .where("dateKey")
    .between(startDate, endDate, true, true)
    .toArray();
}

export async function getAllHabitCompletionsForDate(
  dateKey: string,
): Promise<number[]> {
  const logs = await db.habit_logs
    .where("dateKey")
    .equals(dateKey)
    .toArray();
  return logs.filter((l) => l.completed).map((l) => l.habitId);
}

// ---- Streaks ----

/** Helper: format a Date as YYYY-MM-DD */
function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Helper: subtract days from a date string */
function subtractDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() - n);
  return dateToISO(d);
}

/**
 * Walk backward from today counting consecutive completed days.
 * Rule: if two misses occur within 7 calendar days of each other, the streak ends.
 * A single miss is forgiven as long as the next miss is 7+ days away.
 * Only completed days are counted toward the streak total.
 */
export async function getHabitStreak(habitId: number): Promise<number> {
  const today = todayISO();
  const logs = await db.habit_logs
    .where("[habitId+dateKey]")
    .between([habitId, "0000-00-00"], [habitId, today], true, true)
    .toArray();

  const completedSet = new Set<string>();
  for (const log of logs) {
    if (log.completed) completedSet.add(log.dateKey);
  }

  return computeStreak(completedSet, today);
}

/**
 * Scan all logs for the longest streak (same sliding-window miss rule).
 */
export async function getBestStreak(habitId: number): Promise<number> {
  const logs = await db.habit_logs
    .where("habitId")
    .equals(habitId)
    .toArray();

  const completedSet = new Set<string>();
  let maxDate = "";
  let minDate = "";
  for (const log of logs) {
    if (log.completed) {
      completedSet.add(log.dateKey);
      if (!maxDate || log.dateKey > maxDate) maxDate = log.dateKey;
      if (!minDate || log.dateKey < minDate) minDate = log.dateKey;
    }
  }

  if (completedSet.size === 0) return 0;

  return computeBestStreak(completedSet, minDate, maxDate);
}

/**
 * Compute current streak walking backward from startDate.
 *
 * Sliding-window rule: if two miss days are fewer than 7 calendar days
 * apart, the streak ends at the second miss. Only completed days count.
 */
function computeStreak(completedSet: Set<string>, startDate: string): number {
  let streak = 0;
  let prevMissOffset = -Infinity;

  for (let i = 0; i <= 1095; i++) {
    const key = subtractDays(startDate, i);

    if (completedSet.has(key)) {
      streak++;
    } else {
      if (i - prevMissOffset < 7) {
        // Two misses within a 7-day window → streak ends
        break;
      }
      prevMissOffset = i;
    }
  }

  return streak;
}

/**
 * Compute best streak across all time (forward scan from minDate to maxDate).
 *
 * Same sliding-window rule: two misses within 7 days break the streak.
 * When a streak breaks, restart counting from the day after the previous miss
 * so overlapping streaks are not lost.
 */
function computeBestStreak(
  completedSet: Set<string>,
  minDate: string,
  maxDate: string,
): number {
  if (completedSet.size === 0) return 0;

  const start = new Date(minDate + "T00:00:00");
  const totalDays =
    Math.floor((new Date(maxDate + "T00:00:00").getTime() - start.getTime()) / 86400000) + 1;

  const days: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    days.push(dateToISO(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }

  let best = 0;
  let streak = 0;
  let prevMissIdx = -Infinity;

  for (let i = 0; i < days.length; i++) {
    if (completedSet.has(days[i]!)) {
      streak++;
    } else {
      if (i - prevMissIdx < 7) {
        // Second miss within 7 days → streak broken
        best = Math.max(best, streak);
        // Recount completed days from the day after the previous miss to i-1
        streak = 0;
        for (let k = prevMissIdx + 1; k < i; k++) {
          if (completedSet.has(days[k]!)) streak++;
        }
      }
      prevMissIdx = i;
    }
  }

  return Math.max(best, streak);
}
