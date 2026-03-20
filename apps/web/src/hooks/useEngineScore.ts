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

export type UseEngineScoreResult = {
  score: DayScore;
  isLoading: boolean;
};

export type UseEngineConsistencyResult = {
  consistency: ConsistencyResult;
  isLoading: boolean;
};

/**
 * Reactive hook that returns the day score for a given engine and date.
 * Automatically re-renders when underlying Dexie data changes.
 */
export function useEngineScore(engine: EngineKey, dateKey: string): UseEngineScoreResult {
  const result = useLiveQuery(
    () => getDayScoreForEngine(engine, dateKey),
    [engine, dateKey],
  );
  return {
    score: result ?? EMPTY_SCORE,
    isLoading: result === undefined,
  };
}

/**
 * Reactive hook that returns the monthly consistency stats for a given engine.
 * @param monthKey  Any DateISO within the target month.
 */
export function useEngineConsistency(
  engine: EngineKey,
  monthKey: string,
): UseEngineConsistencyResult {
  const result = useLiveQuery(
    () => getMonthConsistencyForEngine(engine, monthKey),
    [engine, monthKey],
  );
  return {
    consistency: result ?? EMPTY_CONSISTENCY,
    isLoading: result === undefined,
  };
}
