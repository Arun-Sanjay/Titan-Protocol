"use client";

import * as React from "react";

import { chunkDates, listDatesForCycle } from "../../lib/api";
import { HudButton } from "./HudButton";
import { HudCard } from "./HudCard";
import { HudPill } from "./HudPill";

type DayScore = {
  nonNegotiablesDone: number;
  nonNegotiablesTotal: number;
  optionalDone: number;
  optionalTotal: number;
  isFuture?: boolean;
};

type AnalyticsGridProps = {
  startDate: string;
  totalDays: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  getDayScore: (date: string) => DayScore;
  today: string;
};

type Visual = {
  className: string;
  style?: React.CSSProperties;
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDayVisual(
  date: string,
  score: DayScore,
  today: string,
  inRange: boolean,
): Visual {
  const totalAll = Math.max(0, score.nonNegotiablesTotal + score.optionalTotal);
  const completedAll = Math.max(0, score.nonNegotiablesDone + score.optionalDone);
  const isFuture = score.isFuture ?? date > today;

  if (!inRange || isFuture || totalAll === 0) {
    return { className: "tpHeatGray tpDayFuture" };
  }

  if (completedAll === 0) {
    return {
      className: "tpHeatRed",
      style: {
        opacity: 0.92,
        boxShadow: "0 0 18px rgba(255, 80, 80, 0.30)",
      },
    };
  }

  const nonNegTotal = Math.max(0, score.nonNegotiablesTotal);
  const nonNegDone = Math.max(0, score.nonNegotiablesDone);

  if (nonNegTotal > 0 && nonNegDone < nonNegTotal) {
    const lockedPct = clamp(nonNegDone / nonNegTotal);
    return {
      className: "tpHeatYellow",
      style: {
        opacity: 0.72 + lockedPct * 0.28,
        boxShadow: `0 0 ${8 + lockedPct * 18}px rgba(255, 200, 0, ${0.15 + lockedPct * 0.35})`,
      },
    };
  }

  const optionalTotal = Math.max(0, score.optionalTotal);
  const optionalDone = Math.max(0, score.optionalDone);
  const optionalPct = optionalTotal === 0 ? 1 : clamp(optionalDone / optionalTotal);
  const fullComplete = completedAll >= totalAll;

  return {
    className: fullComplete ? "tpHeatGreen tpHeatGreenMax" : "tpHeatGreen",
    style: {
      opacity: 0.75 + optionalPct * 0.25,
      boxShadow: `0 0 ${10 + optionalPct * 20}px rgba(80, 255, 160, ${0.12 + optionalPct * 0.35})`,
    },
  };
}

export function AnalyticsGrid({
  startDate,
  totalDays,
  selectedDate,
  onSelectDate,
  getDayScore,
  today,
}: AnalyticsGridProps) {
  const dates = React.useMemo(() => listDatesForCycle(startDate, totalDays), [startDate, totalDays]);
  const windows = React.useMemo(() => chunkDates(dates, 30), [dates]);

  const selectedIndex = React.useMemo(() => {
    const idx = dates.indexOf(selectedDate);
    if (idx >= 0) return idx;
    const todayIdx = dates.indexOf(today);
    return todayIdx >= 0 ? todayIdx : 0;
  }, [dates, selectedDate, today]);

  const maxWindow = Math.max(0, windows.length - 1);
  const [windowIndex, setWindowIndex] = React.useState(Math.floor(selectedIndex / 30));

  React.useEffect(() => {
    setWindowIndex(Math.max(0, Math.min(maxWindow, Math.floor(selectedIndex / 30))));
  }, [selectedIndex, maxWindow]);

  const visibleWindowIndexes = React.useMemo(() => {
    const center = Math.max(0, Math.min(maxWindow, windowIndex));
    const set = new Set<number>([center - 1, center, center + 1]);
    return [...set].filter((index) => index >= 0 && index <= maxWindow).sort((a, b) => a - b);
  }, [maxWindow, windowIndex]);

  return (
    <HudCard
      title="Analytics"
      rightSlot={<HudPill>Day {Math.max(1, selectedIndex + 1)}/{Math.max(1, dates.length)}</HudPill>}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <HudButton
          className="px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={windowIndex <= 0}
          onClick={() => setWindowIndex((prev) => Math.max(0, prev - 1))}
        >
          Prev 30
        </HudButton>
        <HudButton
          className="px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={windowIndex >= maxWindow}
          onClick={() => setWindowIndex((prev) => Math.min(maxWindow, prev + 1))}
        >
          Next 30
        </HudButton>
        <HudButton className="px-2 py-1 text-xs text-white" onClick={() => onSelectDate(today)}>
          Today
        </HudButton>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {visibleWindowIndexes.map((windowId) => {
          const chunk = windows[windowId] ?? [];
          const startDay = windowId * 30 + 1;
          const endDay = startDay + chunk.length - 1;
          return (
            <div
              key={windowId}
              className="min-w-[290px] snap-start md:min-w-[320px] xl:min-w-[360px]"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/55">
                Window {windowId + 1}/{maxWindow + 1} • Day {startDay}-{endDay}
              </p>
              <div className="grid grid-cols-10 gap-1">
                {chunk.map((date, indexInChunk) => {
                  const dayNumber = windowId * 30 + indexInChunk + 1;
                  const score = getDayScore(date);
                  const visual = resolveDayVisual(date, score, today, true);
                  return (
                    <button
                      key={date}
                      type="button"
                      className={[
                        "tpDayBase",
                        visual.className,
                        selectedDate === date ? "tpDaySelected" : "",
                      ].join(" ")}
                      style={visual.style}
                      onClick={() => onSelectDate(date)}
                      title={`${date}`}
                    >
                      {dayNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </HudCard>
  );
}
