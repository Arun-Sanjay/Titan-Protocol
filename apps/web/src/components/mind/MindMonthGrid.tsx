"use client";

import * as React from "react";

import { addDaysISO, diffDaysISO, toISODateLocal } from "../../lib/date";

type MindGridDay = {
  dateIso: string;
  percent: number;
  completedCount: number;
  totalCount: number;
  focusMinutes: number;
  hasJournal: boolean;
  violationsCount: number;
  interruptionsTotal: number;
};

type MindMonthGridProps = {
  startDate: string;
  durationDays: number;
  selectedDate: string;
  days: MindGridDay[];
  targetMinutes: number;
  onSelectDate: (dateIso: string) => void;
};

const WINDOW_SIZE = 30;

function intensityClass(percent: number): string {
  if (percent >= 100) return "bg-white";
  if (percent >= 80) return "bg-white/80";
  if (percent >= 50) return "bg-white/55";
  if (percent > 0) return "bg-white/25";
  return "bg-white/5";
}

function formatMonthRange(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split("-").map((part) => Number.parseInt(part, 10));
  const [ey, em, ed] = endIso.split("-").map((part) => Number.parseInt(part, 10));
  const start = new Date(sy, (sm || 1) - 1, sd || 1);
  const end = new Date(ey, (em || 1) - 1, ed || 1);
  const left = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const right = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${left} → ${right}`;
}

export function MindMonthGrid({
  startDate,
  durationDays,
  selectedDate,
  days,
  targetMinutes,
  onSelectDate,
}: MindMonthGridProps) {
  const dayMap = React.useMemo(() => new Map(days.map((day) => [day.dateIso, day] as const)), [days]);
  const todayIso = toISODateLocal(new Date());
  const maxWindowIndex = Math.max(0, Math.ceil(durationDays / WINDOW_SIZE) - 1);

  const selectedIndex = React.useMemo(() => {
    const index = diffDaysISO(startDate, selectedDate);
    return Math.max(0, Math.min(durationDays - 1, index));
  }, [durationDays, selectedDate, startDate]);

  const [windowIndex, setWindowIndex] = React.useState(Math.floor(selectedIndex / WINDOW_SIZE));

  React.useEffect(() => {
    setWindowIndex(Math.floor(selectedIndex / WINDOW_SIZE));
  }, [selectedIndex]);

  const safeWindowIndex = Math.max(0, Math.min(maxWindowIndex, windowIndex));
  const windowStartOffset = safeWindowIndex * WINDOW_SIZE;
  const remaining = durationDays - windowStartOffset;
  const windowLength = Math.max(0, Math.min(WINDOW_SIZE, remaining));

  const windowDates = React.useMemo(
    () =>
      Array.from({ length: windowLength }, (_, index) => {
        return addDaysISO(startDate, windowStartOffset + index);
      }),
    [startDate, windowLength, windowStartOffset],
  );

  if (durationDays <= 0) {
    return <p className="text-sm text-white/60">No timeline data available.</p>;
  }

  const windowStartIso = windowDates[0] ?? startDate;
  const windowEndIso = windowDates[windowDates.length - 1] ?? startDate;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/70">
          Window {safeWindowIndex + 1}/{maxWindowIndex + 1} • {formatMonthRange(windowStartIso, windowEndIso)}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWindowIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeWindowIndex <= 0}
            className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              const todayIndex = diffDaysISO(startDate, todayIso);
              const clamped = Math.max(0, Math.min(durationDays - 1, todayIndex));
              onSelectDate(addDaysISO(startDate, clamped));
            }}
            className="hud-btn px-2 py-1 text-xs text-white"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWindowIndex((prev) => Math.min(maxWindowIndex, prev + 1))}
            disabled={safeWindowIndex >= maxWindowIndex}
            className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
        {windowDates.map((dateIso, indexInWindow) => {
          const row = dayMap.get(dateIso);
          const percent = row?.percent ?? 0;
          const isSelected = selectedDate === dateIso;
          const violationsCount = row?.violationsCount ?? 0;
          const focusMinutes = row?.focusMinutes ?? 0;
          const focusHit = focusMinutes >= targetMinutes && targetMinutes > 0;
          const hasJournal = row?.hasJournal ?? false;
          const absoluteDay = windowStartOffset + indexInWindow + 1;

          return (
            <button
              key={dateIso}
              type="button"
              onClick={() => onSelectDate(dateIso)}
              title={`${dateIso} • ${percent}% • ${row?.completedCount ?? 0}/${row?.totalCount ?? 0} tasks • focus ${focusMinutes}m • violations ${violationsCount}`}
              className={[
                "relative h-14 rounded-md border bg-black/20 p-1 text-left transition",
                isSelected ? "border-white ring-1 ring-white" : "border-white/10 hover:border-white/35",
                violationsCount > 0 ? "border-red-300/65" : "",
              ].join(" ")}
            >
              <div className={`h-6 rounded ${intensityClass(percent)}`} />
              <p className="mt-1 text-[10px] text-white/70">D{absoluteDay}</p>
              <div className="absolute right-1 top-1 flex items-center gap-1">
                {hasJournal ? <span className="h-1.5 w-1.5 rounded-full bg-yellow-200" /> : null}
                {focusHit ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-100" /> : null}
              </div>
              {dateIso === todayIso ? (
                <span className="absolute bottom-1 right-1 rounded bg-white/20 px-1 text-[9px] text-white">Today</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
