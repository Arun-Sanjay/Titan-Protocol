"use client";

import * as React from "react";

import type { ConsistencyDay } from "../../lib/body_logs";
import { addDaysISO, diffDaysISO, toISODateLocal } from "../../lib/date";

type AnalyticsTimelineProps = {
  startDate: string;
  durationDays: number;
  selectedDate: string;
  days: ConsistencyDay[];
  onSelectDate: (date: string) => void;
};

const WINDOW_SIZE = 30;

function heatColorClass(percentComplete: number): string {
  if (percentComplete >= 100) return "border-emerald-300/70 bg-emerald-400/35";
  if (percentComplete >= 80) return "border-emerald-300/45 bg-emerald-400/20";
  if (percentComplete >= 50) return "border-white/40 bg-white/20";
  if (percentComplete > 0) return "border-white/20 bg-white/10";
  return "border-white/12 bg-black/25";
}

function clampWindow(index: number, max: number): number {
  return Math.max(0, Math.min(max, index));
}

export function AnalyticsTimeline({
  startDate,
  durationDays,
  selectedDate,
  days,
  onSelectDate,
}: AnalyticsTimelineProps) {
  const today = toISODateLocal(new Date());
  const dayMap = React.useMemo(() => new Map(days.map((day) => [day.date, day] as const)), [days]);
  const maxWindowIndex = Math.max(0, Math.ceil(Math.max(durationDays, 1) / WINDOW_SIZE) - 1);
  const selectedIndex = Math.max(0, Math.min(Math.max(durationDays - 1, 0), diffDaysISO(startDate, selectedDate)));
  const [windowIndex, setWindowIndex] = React.useState(Math.floor(selectedIndex / WINDOW_SIZE));

  React.useEffect(() => {
    setWindowIndex(Math.floor(selectedIndex / WINDOW_SIZE));
  }, [selectedIndex]);

  const safeWindow = clampWindow(windowIndex, maxWindowIndex);
  const offset = safeWindow * WINDOW_SIZE;
  const length = Math.min(WINDOW_SIZE, Math.max(durationDays - offset, 0));
  const windowDates = React.useMemo(
    () => Array.from({ length }, (_, index) => addDaysISO(startDate, offset + index)),
    [length, offset, startDate],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-white/65">
          Window {safeWindow + 1}/{maxWindowIndex + 1} • Day {offset + 1}-{offset + windowDates.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWindowIndex((prev) => clampWindow(prev - 1, maxWindowIndex))}
            disabled={safeWindow <= 0}
            className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              const todayIndex = Math.max(0, Math.min(durationDays - 1, diffDaysISO(startDate, today)));
              onSelectDate(addDaysISO(startDate, todayIndex));
            }}
            className="hud-btn px-2 py-1 text-xs text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWindowIndex((prev) => clampWindow(prev + 1, maxWindowIndex))}
            disabled={safeWindow >= maxWindowIndex}
            className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1">
        {windowDates.map((date, index) => {
          const value = dayMap.get(date);
          const percentComplete = value?.percentComplete ?? 0;
          const isSelected = selectedDate === date;
          const isToday = date === today;
          const dayNumber = offset + index + 1;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`relative h-9 rounded border text-[10px] text-white/75 transition-colors ${heatColorClass(percentComplete)} ${
                isSelected ? "ring-1 ring-white/80" : ""
              }`}
              title={`${date} • ${percentComplete}% (${value?.doneCount ?? 0}/${value?.totalCount ?? 0})`}
            >
              <span>{dayNumber}</span>
              {isToday ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/90" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
