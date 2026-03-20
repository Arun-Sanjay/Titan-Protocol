import { describe, it, expect } from "vitest";
import {
  computeDayScoreFromCounts,
  computeTitanPercent,
  computeMonthConsistency,
  EMPTY_SCORE,
} from "../scoring";

describe("computeDayScoreFromCounts", () => {
  it("computes weighted score correctly", () => {
    // 2 main (2pts each) + 3 secondary (1pt each) = 7 total points
    // 1 main done (2pts) + 2 secondary done (2pts) = 4 done points
    const score = computeDayScoreFromCounts(2, 1, 3, 2);
    expect(score.mainTotal).toBe(2);
    expect(score.mainDone).toBe(1);
    expect(score.secondaryTotal).toBe(3);
    expect(score.secondaryDone).toBe(2);
    expect(score.pointsTotal).toBe(7); // 2*2 + 3
    expect(score.pointsDone).toBe(4); // 1*2 + 2
    expect(score.percent).toBe(57); // Math.round(4/7 * 100)
  });

  it("returns 0% when no tasks exist", () => {
    const score = computeDayScoreFromCounts(0, 0, 0, 0);
    expect(score.percent).toBe(0);
    expect(score.pointsTotal).toBe(0);
    expect(score.pointsDone).toBe(0);
  });

  it("returns 100% when all tasks completed", () => {
    const score = computeDayScoreFromCounts(3, 3, 2, 2);
    expect(score.percent).toBe(100);
  });

  it("handles main-only tasks", () => {
    const score = computeDayScoreFromCounts(2, 1, 0, 0);
    expect(score.pointsTotal).toBe(4); // 2*2
    expect(score.pointsDone).toBe(2); // 1*2
    expect(score.percent).toBe(50);
  });

  it("handles secondary-only tasks", () => {
    const score = computeDayScoreFromCounts(0, 0, 4, 3);
    expect(score.pointsTotal).toBe(4);
    expect(score.pointsDone).toBe(3);
    expect(score.percent).toBe(75);
  });
});

describe("computeTitanPercent", () => {
  it("averages only active engines (pointsTotal > 0)", () => {
    const scores = [
      { percent: 80, pointsTotal: 10 },
      { percent: 60, pointsTotal: 5 },
      { percent: 0, pointsTotal: 0 }, // inactive
      { percent: 0, pointsTotal: 0 }, // inactive
    ];
    expect(computeTitanPercent(scores)).toBe(70); // (80 + 60) / 2
  });

  it("returns 0 when no engines are active", () => {
    const scores = [
      { percent: 0, pointsTotal: 0 },
      { percent: 0, pointsTotal: 0 },
    ];
    expect(computeTitanPercent(scores)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    const scores = [
      { percent: 33, pointsTotal: 1 },
      { percent: 66, pointsTotal: 1 },
      { percent: 50, pointsTotal: 1 },
    ];
    // (33 + 66 + 50) / 3 = 49.666... → 50
    expect(computeTitanPercent(scores)).toBe(50);
  });
});

describe("EMPTY_SCORE", () => {
  it("has all zeros", () => {
    expect(EMPTY_SCORE.percent).toBe(0);
    expect(EMPTY_SCORE.mainDone).toBe(0);
    expect(EMPTY_SCORE.mainTotal).toBe(0);
    expect(EMPTY_SCORE.secondaryDone).toBe(0);
    expect(EMPTY_SCORE.secondaryTotal).toBe(0);
    expect(EMPTY_SCORE.pointsDone).toBe(0);
    expect(EMPTY_SCORE.pointsTotal).toBe(0);
  });
});

describe("computeMonthConsistency", () => {
  it("computes consistency for a full month", () => {
    const scoreMap: Record<string, number> = {};
    // 10 days above threshold
    for (let i = 1; i <= 10; i++) {
      scoreMap[`2024-03-${String(i).padStart(2, "0")}`] = 80;
    }
    // 5 days below threshold
    for (let i = 11; i <= 15; i++) {
      scoreMap[`2024-03-${String(i).padStart(2, "0")}`] = 40;
    }

    const result = computeMonthConsistency(
      scoreMap,
      "2024-03-01",
      "2024-03-15",
      "2024-03-01",
      "2024-03-15",
      60,
    );

    expect(result.consistentDays).toBe(10);
    expect(result.daysElapsed).toBe(15);
    expect(result.consistencyPct).toBe(67); // Math.round(10/15 * 100)
  });

  it("computes streaks correctly", () => {
    const scoreMap: Record<string, number> = {
      "2024-03-01": 80,
      "2024-03-02": 80,
      "2024-03-03": 80, // 3-day streak
      "2024-03-04": 20, // break
      "2024-03-05": 80,
      "2024-03-06": 80, // 2-day streak (current)
    };

    const result = computeMonthConsistency(
      scoreMap,
      "2024-03-01",
      "2024-03-06",
      "2024-03-01",
      "2024-03-06",
      60,
    );

    expect(result.bestStreak).toBe(3);
    expect(result.currentStreak).toBe(2);
  });

  it("handles empty score map", () => {
    const result = computeMonthConsistency({}, "2024-03-01", "2024-03-31", "2024-03-01", "2024-03-15", 60);
    expect(result.consistentDays).toBe(0);
    expect(result.daysElapsed).toBe(15);
    expect(result.consistencyPct).toBe(0);
  });

  it("respects dataStartKey later than monthStartKey", () => {
    const scoreMap: Record<string, number> = {
      "2024-03-05": 80,
      "2024-03-06": 80,
    };

    const result = computeMonthConsistency(
      scoreMap,
      "2024-03-01",
      "2024-03-06",
      "2024-03-05", // data starts later
      "2024-03-06",
      60,
    );

    expect(result.daysElapsed).toBe(2);
    expect(result.consistentDays).toBe(2);
    expect(result.consistencyPct).toBe(100);
  });

  it("returns zeros when effectiveStart > effectiveEnd", () => {
    const result = computeMonthConsistency({}, "2024-03-01", "2024-03-31", "2024-04-01", "2024-03-15", 60);
    expect(result.consistencyPct).toBe(0);
    expect(result.daysElapsed).toBe(0);
  });
});
