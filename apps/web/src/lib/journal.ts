import { db } from "./db";
import type { JournalEntry } from "./db";
import { assertDateISO } from "./date";

/**
 * Returns the journal entry for a given date, or undefined if none exists.
 */
export async function getEntry(
  dateKey: string,
): Promise<JournalEntry | undefined> {
  const safeDate = assertDateISO(dateKey);
  return db.journal_entries.get(safeDate);
}

/**
 * Upserts a journal entry for the given date.
 * Uses `put` so an existing entry for that dateKey is replaced.
 */
export async function saveEntry(
  dateKey: string,
  content: string,
): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  await db.journal_entries.put({
    dateKey: safeDate,
    content,
    updatedAt: Date.now(),
  });
}

/**
 * Deletes the journal entry for the given date.
 */
export async function deleteEntry(dateKey: string): Promise<void> {
  const safeDate = assertDateISO(dateKey);
  await db.journal_entries.delete(safeDate);
}

/**
 * Full-text search via `.filter()` on content.
 * Returns matching entries sorted by dateKey descending.
 */
export async function searchEntries(query: string): Promise<JournalEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = await db.journal_entries
    .filter((entry) => entry.content.toLowerCase().includes(q))
    .toArray();

  return matches.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/**
 * Returns last N entries that have non-empty content, sorted by dateKey desc.
 */
export async function listRecentEntries(
  limit: number,
): Promise<JournalEntry[]> {
  const all = await db.journal_entries
    .orderBy("dateKey")
    .reverse()
    .filter((entry) => entry.content.trim().length > 0)
    .limit(limit)
    .toArray();

  return all;
}
