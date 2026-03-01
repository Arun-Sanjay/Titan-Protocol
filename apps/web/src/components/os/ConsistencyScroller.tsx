"use client";

import * as React from "react";

import {
  chunkDates,
  computeDayColor,
  listDatesForCycle,
  type DayColorInput,
  type DayColorResult,
} from "../../lib/api";

function dayClass(color: DayColorResult): string {
  if (color.stage === "empty") return "bg-red-500/25 border-red-300/25";
  if (color.stage === "progress") return "bg-amber-400/20 border-amber-200/30";
  if (color.stage === "baseline_green") return "bg-emerald-400/20 border-emerald-300/30";
  return "bg-emerald-300/35 border-emerald-100/40";
}

export function ConsistencyScroller({
  cycleStartDate,
  cycleLength,
  selectedDate,
  todayDate,
  completionMap,
  onSelectDate,
}: {
  cycleStartDate: string;
  cycleLength: number;
  selectedDate: string;
  todayDate: string;
  completionMap: Record<string, DayColorInput>;
  onSelectDate: (date: string) => void;
}) {
  const dates = React.useMemo(() => listDatesForCycle(cycleStartDate, cycleLength), [cycleStartDate, cycleLength]);
  const chunks = React.useMemo(() => chunkDates(dates, 30), [dates]);

  if (dates.length === 0) {
    return (
      <article className="chrome-panel p-4">
        <p className="text-sm text-white/70">No active cycle yet.</p>
      </article>
    );
  }

  return (
    <article className="chrome-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">Consistency</p>
          <p className="text-xs text-white/60">Scroll through 30-day chunks from Day 1.</p>
        </div>
        <button type="button" onClick={() => onSelectDate(todayDate)} className="chrome-btn px-2 py-1 text-xs text-white">
          Today
        </button>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
        {chunks.map((chunk, index) => (
          <div key={index} className="min-w-[290px] snap-start md:min-w-[320px] xl:min-w-[360px]">
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/55">
              Days {index * 30 + 1}-{index * 30 + chunk.length}
            </p>
            <div className="grid grid-cols-10 gap-1">
              {chunk.map((date, chunkIndex) => {
                const counts = completionMap[date] ?? {
                  nonneg_done: 0,
                  nonneg_total: 0,
                  total_done: 0,
                  total_total: 0,
                };
                const color = computeDayColor(counts);
                const isToday = date === todayDate;
                const isSelected = date === selectedDate;
                const dayNumber = index * 30 + chunkIndex + 1;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onSelectDate(date)}
                    className={[
                      "h-8 rounded-md border text-[10px] transition",
                      dayClass(color),
                      isSelected ? "ring-1 ring-white/90" : "",
                      isToday ? "shadow-[0_0_10px_rgba(255,255,255,0.35)]" : "",
                    ].join(" ")}
                    style={{
                      opacity: color.stage === "empty" ? 0.75 : 0.65 + color.intensity * 0.35,
                    }}
                    title={`${date}`}
                  >
                    {dayNumber}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
