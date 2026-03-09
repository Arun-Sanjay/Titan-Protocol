import { db } from "./db";
import type { BodyWeightEntry } from "./db";
import { assertDateISO, todayISO } from "./date";

/**
 * Returns all weight entries sorted by dateKey ascending.
 */
export async function listWeightEntries(): Promise<BodyWeightEntry[]> {
  return db.body_weight_entries.orderBy("dateKey").toArray();
}

/**
 * Upserts a weight entry for the given date.
 * Uses `put` so an existing entry for that dateKey is replaced.
 */
export async function addWeightEntry(
  dateKey: string,
  weightKg: number,
): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  await db.body_weight_entries.put({
    dateKey: safeDate,
    weightKg,
    createdAt: Date.now(),
  });
}

/**
 * Deletes the weight entry for the given date.
 */
export async function deleteWeightEntry(dateKey: string): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  await db.body_weight_entries.delete(safeDate);
}

/**
 * Returns the most recent weight entry (by dateKey descending), or undefined.
 */
export async function getLatestWeight(): Promise<BodyWeightEntry | undefined> {
  return db.body_weight_entries.orderBy("dateKey").reverse().first();
}

/**
 * Returns the weight change over the last N days.
 * Compares the entry closest to today with the entry closest to (today - N days).
 * Returns null if there is not enough data (need at least two entries in range).
 */
export async function getWeightChange(
  days: number,
): Promise<number | null> {
  const today = todayISO();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

  // Get the most recent entry (closest to today)
  const latestEntry = await db.body_weight_entries
    .where("dateKey")
    .belowOrEqual(today)
    .reverse()
    .first();

  if (!latestEntry) return null;

  // Get the entry closest to the cutoff date (on or before cutoff)
  const oldEntry = await db.body_weight_entries
    .where("dateKey")
    .belowOrEqual(cutoffKey)
    .reverse()
    .first();

  // If no old entry, try the earliest entry within the range
  if (!oldEntry) {
    const earliestInRange = await db.body_weight_entries
      .where("dateKey")
      .aboveOrEqual(cutoffKey)
      .first();
    if (!earliestInRange || earliestInRange.dateKey === latestEntry.dateKey) {
      return null;
    }
    return latestEntry.weightKg - earliestInRange.weightKg;
  }

  if (oldEntry.dateKey === latestEntry.dateKey) return null;

  return latestEntry.weightKg - oldEntry.weightKg;
}

/**
 * Returns weight entries for the last N days (for graphing).
 */
export async function getWeightTrend(
  days: number,
): Promise<BodyWeightEntry[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffKey = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;

  return db.body_weight_entries
    .where("dateKey")
    .aboveOrEqual(cutoffKey)
    .sortBy("dateKey");
}
