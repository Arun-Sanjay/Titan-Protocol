"use client";

import * as React from "react";

import { addDaysISO, diffDaysISO, toISODateLocal } from "../../lib/date";

type MindTimelineDay = {
  dateIso: string;
  percent: number;
  completedCount: number;
  totalCount: number;
  focusMinutes: number;
  hasJournal: boolean;
  archivedCompletedCount?: number;
  violationsCount?: number;
  interruptionsTotal?: number;
  focusQuality?: number;
};

type MindTimelineProps = {
  startDate: string;
  durationDays: number;
  selectedDate: string;
  days: MindTimelineDay[];
  onSelectDate: (dateIso: string) => void;
};

const CHUNK_SIZE = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const values: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    values.push(items.slice(index, index + size));
  }
  return values;
}

function fillClass(percent: number): string {
  if (percent >= 100) return "bg-emerald-300/90";
  if (percent > 0) return "bg-white/35";
  return "bg-white/5";
}

function dayLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MindTimeline({ startDate, durationDays, selectedDate, days, onSelectDate }: MindTimelineProps) {
  const timelineEnd = React.useMemo(() => addDaysISO(startDate, Math.max(0, durationDays - 1)), [durationDays, startDate]);

  const allDates = React.useMemo(() => {
    const values: string[] = [];
    for (let offset = 0; offset < durationDays; offset += 1) {
      values.push(addDaysISO(startDate, offset));
    }
    return values;
  }, [durationDays, startDate]);

  const dayMap = React.useMemo(() => new Map(days.map((day) => [day.dateIso, day] as const)), [days]);
  const chunks = React.useMemo(() => chunk(allDates, CHUNK_SIZE), [allDates]);

  const selectedIndex = React.useMemo(() => {
    const index = diffDaysISO(startDate, selectedDate);
    if (!Number.isFinite(index)) return 0;
    return Math.max(0, Math.min(allDates.length - 1, index));
  }, [allDates.length, selectedDate, startDate]);

  const selectedChunkIndex = Math.floor(selectedIndex / CHUNK_SIZE);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const chunkRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const autoScrolledRef = React.useRef(false);

  React.useEffect(() => {
    autoScrolledRef.current = false;
  }, [startDate, durationDays]);

  React.useEffect(() => {
    if (autoScrolledRef.current) return;
    const container = containerRef.current;
    const chunkElement = chunkRefs.current[selectedChunkIndex];
    if (!container || !chunkElement) return;

    container.scrollTo({
      left: chunkElement.offsetLeft,
      behavior: "smooth",
    });
    autoScrolledRef.current = true;
  }, [selectedChunkIndex]);

  const todayIso = toISODateLocal(new Date());

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
        <p>
          Timeline {startDate} → {timelineEnd}
        </p>
        <p>
          Day {selectedIndex + 1}/{durationDays}
        </p>
      </div>

      <div ref={containerRef} className="overflow-x-auto pb-2 [scroll-snap-type:x_mandatory]">
        <div className="flex gap-3">
          {chunks.map((chunkDates, chunkIndex) => (
            <div
              key={`mind-chunk-${chunkIndex}`}
              ref={(node) => {
                chunkRefs.current[chunkIndex] = node;
              }}
              className="min-w-[860px] [scroll-snap-align:start]"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                <span>Days {chunkIndex * CHUNK_SIZE + 1}–{chunkIndex * CHUNK_SIZE + chunkDates.length}</span>
                <span>{dayLabel(chunkDates[0])} → {dayLabel(chunkDates[chunkDates.length - 1])}</span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {chunkDates.map((dateIso, indexInChunk) => {
                  const row = dayMap.get(dateIso);
                  const isSelected = dateIso === selectedDate;
                  const isToday = dateIso === todayIso;
                  const percent = row?.percent ?? 0;
                  const violationsCount = row?.violationsCount ?? 0;
                  const interruptionsTotal = row?.interruptionsTotal ?? 0;
                  const focusMinutes = row?.focusMinutes ?? 0;
                  const quality = row?.focusQuality ?? 100;
                  const hasJournal = row?.hasJournal ? "yes" : "no";

                  return (
                    <button
                      key={dateIso}
                      type="button"
                      onClick={() => onSelectDate(dateIso)}
                      className={[
                        "relative h-14 rounded-md border p-1 text-left transition",
                        isSelected
                          ? "border-white/80 ring-1 ring-white/70"
                          : "border-white/15 hover:border-white/35",
                        "bg-black/25",
                      ].join(" ")}
                      title={`${dateIso} • ${percent}% • focus ${focusMinutes}m • violations ${violationsCount} • interruptions ${interruptionsTotal} • journal ${hasJournal} • quality ${quality}%`}
                    >
                      <div className={`h-6 rounded ${fillClass(percent)}`} />
                      <p className="mt-1 text-[10px] text-white/70">{chunkIndex * CHUNK_SIZE + indexInChunk + 1}</p>
                      {row?.hasJournal ? (
                        <span className="absolute right-1 top-1 inline-block h-1.5 w-1.5 rounded-full bg-cyan-200" />
                      ) : null}
                      {isToday ? (
                        <span className="absolute bottom-1 right-1 rounded bg-white/20 px-1 text-[9px] text-white">Today</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
