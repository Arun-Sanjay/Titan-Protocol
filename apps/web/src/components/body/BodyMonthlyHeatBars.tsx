"use client";

import * as React from "react";

type BodyMonthlyHeatBarsProps = {
  visibleMonth: Date;
  scoreMap: Record<string, number>;
  startDateKey?: string;
  todayKey: string;
  maxBarHeight?: number;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getDaysInMonth(date: Date): number {
  return endOfMonth(date).getDate();
}

function getDayVisual(dateKey: string, scorePct: number, isFuture: boolean, isBeforeStart: boolean) {
  if (isFuture || isBeforeStart) {
    return { state: "grey" as const, intensity: 0 };
  }
  if (scorePct === 0) {
    return { state: "red" as const, intensity: 0 };
  }
  if (scorePct < 60) {
    return { state: "yellow" as const, intensity: Math.min(1, scorePct / 60) };
  }
  return { state: "green" as const, intensity: Math.min(1, (scorePct - 60) / 40) };
}

export function BodyMonthlyHeatBars({
  visibleMonth,
  scoreMap,
  startDateKey,
  todayKey,
  maxBarHeight = 64,
}: BodyMonthlyHeatBarsProps) {
  const totalDays = getDaysInMonth(visibleMonth);

  const bars = React.useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), i + 1);
      const dateKey = toDateKey(date);
      const scorePct = scoreMap[dateKey] ?? 0;
      const isFuture = dateKey > todayKey;
      const isBeforeStart = startDateKey ? dateKey < startDateKey : false;
      const visual = getDayVisual(dateKey, scorePct, isFuture, isBeforeStart);
      const height = Math.round((scorePct / 100) * maxBarHeight);
      return { dateKey, height, visual };
    });
  }, [maxBarHeight, scoreMap, startDateKey, todayKey, totalDays, visibleMonth]);

  return (
    <div className="body-heatbars">
      {bars.map((bar) => {
        const className = [
          "body-heatbar",
          bar.visual.state === "grey" ? "day-grey" : "",
          bar.visual.state === "red" ? "day-red" : "",
          bar.visual.state === "yellow" ? "day-yellow" : "",
          bar.visual.state === "green" ? "day-green" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span
            key={bar.dateKey}
            className={className}
            style={{
              ["--heat" as never]: bar.visual.intensity,
              height: `${bar.height}px`,
            }}
          />
        );
      })}
    </div>
  );
}
