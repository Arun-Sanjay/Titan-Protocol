"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  getDayScoreForEngine,
  getMonthConsistencyForEngine,
  type ConsistencyResult,
  type DayScore,
  type EngineKey,
  EMPTY_SCORE,
} from "@/lib/scoring";

const EMPTY_CONSISTENCY: ConsistencyResult = {
  percent: 0,
  consistentDays: 0,
  totalDays: 0,
  currentStreak: 0,
  bestStreak: 0,
};

/**
 * Reactive hook that returns the day score for a given engine and date.
 * Automatically re-renders when underlying Dexie data changes.
 */
export function useEngineScore(engine: EngineKey, dateKey: string): DayScore {
  return (
    useLiveQuery(() => getDayScoreForEngine(engine, dateKey), [engine, dateKey]) ?? EMPTY_SCORE
  );
}

/**
 * Reactive hook that returns the monthly consistency stats for a given engine.
 * @param monthKey  Any DateISO within the target month.
 */
export function useEngineConsistency(
  engine: EngineKey,
  monthKey: string,
): ConsistencyResult {
  return (
    useLiveQuery(
      () => getMonthConsistencyForEngine(engine, monthKey),
      [engine, monthKey],
    ) ?? EMPTY_CONSISTENCY
  );
}
