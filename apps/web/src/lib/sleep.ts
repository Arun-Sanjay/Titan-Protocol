import { db, type SleepEntry } from "./db";
import { todayISO } from "./date";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function addSleepEntry(entry: Omit<SleepEntry, "createdAt">): Promise<void> {
  await db.sleep_entries.put({
    ...entry,
    createdAt: Date.now(),
  });
}

export async function deleteSleepEntry(dateKey: string): Promise<void> {
  await db.sleep_entries.delete(dateKey);
}

export async function getSleepEntry(dateKey: string): Promise<SleepEntry | undefined> {
  return db.sleep_entries.get(dateKey);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listSleepEntries(limit = 30): Promise<SleepEntry[]> {
  return db.sleep_entries
    .orderBy("dateKey")
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getSleepEntriesForRange(
  startDate: string,
  endDate: string,
): Promise<SleepEntry[]> {
  return db.sleep_entries
    .where("dateKey")
    .between(startDate, endDate, true, true)
    .toArray();
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type SleepStats = {
  avgDuration: number;
  avgQuality: number;
  avgBedtime: string;
  avgWakeTime: string;
  totalEntries: number;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMins: number): string {
  // Handles wrap-around (e.g. 1440+ minutes)
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = Math.round(normalized % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function getSleepStats(days = 7): Promise<SleepStats> {
  const today = todayISO();
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const startDate = `${y}-${m}-${day}`;

  const entries = await getSleepEntriesForRange(startDate, today);

  if (entries.length === 0) {
    return {
      avgDuration: 0,
      avgQuality: 0,
      avgBedtime: "--:--",
      avgWakeTime: "--:--",
      totalEntries: 0,
    };
  }

  let totalDuration = 0;
  let totalQuality = 0;
  let totalBedtimeMins = 0;
  let totalWakeMins = 0;

  for (const entry of entries) {
    totalDuration += entry.durationMinutes;
    totalQuality += entry.quality;
    // Handle bedtime: if after midnight (0-6), add 24h for avg calculation
    let bedMins = timeToMinutes(entry.bedtime);
    if (bedMins < 360) bedMins += 1440; // Before 6 AM → treat as same night
    totalBedtimeMins += bedMins;
    totalWakeMins += timeToMinutes(entry.wakeTime);
  }

  const n = entries.length;
  return {
    avgDuration: Math.round(totalDuration / n),
    avgQuality: Math.round((totalQuality / n) * 10) / 10,
    avgBedtime: minutesToTime(Math.round(totalBedtimeMins / n)),
    avgWakeTime: minutesToTime(Math.round(totalWakeMins / n)),
    totalEntries: n,
  };
}

/**
 * Compute sleep duration in minutes from bedtime and wake time strings.
 * Assumes sleep crosses midnight if wakeTime < bedtime.
 */
export function computeDuration(bedtime: string, wakeTime: string): number {
  const bedMins = timeToMinutes(bedtime);
  let wakeMins = timeToMinutes(wakeTime);
  if (wakeMins <= bedMins) wakeMins += 1440; // next day
  return wakeMins - bedMins;
}
