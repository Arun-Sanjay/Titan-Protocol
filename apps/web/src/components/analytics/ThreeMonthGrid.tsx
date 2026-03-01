"use client";

import * as React from "react";

import type { DayCounts } from "../../lib/analytics";
import { toISODateLocal } from "../../lib/date";

type ThreeMonthGridProps = {
  selectedDate: string;
  programStart?: string;
  programEnd?: string;
  todayStr: string;
  countsMap: Record<string, DayCounts>;
  onSelectDate: (dateIso: string) => void;
};

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

function dateToISO(value: Date): string {
  return toISODateLocal(value);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function buildMonthDays(monthDate: Date): Array<{ dateIso: string | null; inMonth: boolean }> {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const firstWeekday = first.getDay();
  const days: Array<{ dateIso: string | null; inMonth: boolean }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    days.push({ dateIso: null, inMonth: false });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push({
      dateIso: dateToISO(new Date(monthDate.getFullYear(), monthDate.getMonth(), day)),
      inMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    days.push({ dateIso: null, inMonth: false });
  }

  return days;
}

type ResolvedDayVisual = {
  className: string;
  style?: React.CSSProperties;
  disabled: boolean;
  stage: "future" | "disabled" | "neutral" | "red" | "locked_incomplete" | "locked_complete";
  showLock: boolean;
};

function resolveDayVisual(input: {
  dateStr: string;
  counts: DayCounts | undefined;
  todayStr: string;
  programStart: string;
  programEnd: string;
}): ResolvedDayVisual {
  const { dateStr, counts, todayStr, programStart, programEnd } = input;
  const inRange = dateStr >= programStart && dateStr <= programEnd;
  const isFuture = dateStr > todayStr;

  if (isFuture) {
    return {
      className: "tpDayBase tpDayDisabled tpDayFuture tpHeatGray",
      disabled: true,
      stage: "future",
      showLock: false,
    };
  }

  if (!inRange) {
    return {
      className: "tpDayBase tpDayDisabled tpHeatGray",
      disabled: true,
      stage: "disabled",
      showLock: false,
    };
  }

  const totalAll = counts?.totalAll ?? 0;
  const completedAll = Math.min(totalAll, Math.max(0, counts?.completedAll ?? 0));
  const totalLocked = Math.min(totalAll, Math.max(0, counts?.totalLocked ?? 0));
  const completedLocked = Math.min(totalLocked, Math.max(0, counts?.completedLocked ?? 0));

  if (totalAll === 0) {
    return {
      className: "tpDayBase tpDayNeutral tpHeatGray",
      disabled: false,
      stage: "neutral",
      showLock: false,
    };
  }

  if (completedAll === 0) {
    return {
      className: "tpDayBase tpHeatRed",
      style: {
        opacity: 0.9,
        boxShadow: "0 0 18px rgba(255, 80, 80, 0.30)",
      },
      disabled: false,
      stage: "red",
      showLock: false,
    };
  }

  if (totalLocked > 0 && completedLocked < totalLocked) {
    const lockedPct = completedLocked / totalLocked;
    const clamped = Math.max(0, Math.min(1, lockedPct));
    return {
      className: "tpDayBase tpHeatYellow",
      style: {
        opacity: 0.7 + clamped * 0.3,
        boxShadow: `0 0 ${8 + clamped * 18}px rgba(255, 200, 0, ${0.15 + clamped * 0.35})`,
      },
      disabled: false,
      stage: "locked_incomplete",
      showLock: true,
    };
  }

  const optionalTotal = Math.max(0, totalAll - totalLocked);
  const optionalDone = Math.max(0, completedAll - completedLocked);
  const optionalPct = optionalTotal === 0 ? 1 : optionalDone / optionalTotal;
  const clampedOptional = Math.max(0, Math.min(1, optionalPct));
  const allComplete = completedAll === totalAll;

  return {
    className: `tpDayBase tpHeatGreen ${allComplete ? "tpHeatGreenMax" : ""}`,
    style: {
      opacity: 0.75 + clampedOptional * 0.25,
      boxShadow: `0 0 ${10 + clampedOptional * 20}px rgba(80, 255, 160, ${0.12 + clampedOptional * 0.35})`,
    },
    disabled: false,
    stage: "locked_complete",
    showLock: false,
  };
}

export function ThreeMonthGrid({
  selectedDate,
  programStart,
  programEnd,
  countsMap,
  todayStr,
  onSelectDate,
}: ThreeMonthGridProps) {
  const resolvedToday = todayStr || toISODateLocal(new Date());
  const resolvedProgramStart = programStart ?? resolvedToday;
  const resolvedProgramEnd = programEnd ?? resolvedToday;
  const anchorMonth = startOfMonth(parseDateOnly(selectedDate || resolvedToday));
  const months = [addMonths(anchorMonth, -1), anchorMonth, addMonths(anchorMonth, 1)];

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[760px] gap-3">
        {months.map((monthDate) => {
          const monthLabel = monthDate.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });
          const cells = buildMonthDays(monthDate);
          return (
            <section key={monthLabel} className="hud-panel flex-1 p-3">
              <h4 className="mb-2 text-center text-xs uppercase tracking-[0.14em] text-white/70">
                {monthLabel}
              </h4>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-white/45">
                {["S", "M", "T", "W", "T", "F", "S"].map((weekday, index) => (
                  <span key={`${weekday}-${index}`}>{weekday}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, index) => {
                  if (!cell.dateIso) {
                    return (
                      <div
                        key={`empty-${monthLabel}-${index}`}
                        className="tpDayBase border-transparent bg-transparent"
                      />
                    );
                  }
                  const day = Number.parseInt(cell.dateIso.slice(8), 10);
                  const visual = resolveDayVisual({
                    dateStr: cell.dateIso,
                    counts: countsMap[cell.dateIso],
                    todayStr: resolvedToday,
                    programStart: resolvedProgramStart,
                    programEnd: resolvedProgramEnd,
                  });
                  const selected = selectedDate === cell.dateIso;
                  const microGlow = selected && visual.stage === "locked_complete";
                  return (
                    <button
                      key={cell.dateIso}
                      type="button"
                      disabled={visual.disabled}
                      onClick={() => onSelectDate(cell.dateIso as string)}
                      className={`${visual.className} ${selected ? "tpDaySelected" : ""} ${
                        microGlow ? "tpArcMicroGlow" : ""
                      }`}
                      data-stage={visual.stage}
                      data-selected={selected ? "true" : "false"}
                      data-lock={visual.showLock ? "true" : "false"}
                      style={visual.style}
                      title={`${cell.dateIso}`}
                    >
                      {visual.showLock ? (
                        <span className="tpLockBadge" aria-hidden="true">
                          <svg viewBox="0 0 16 16" fill="none">
                            <path
                              d="M5.5 7V5.75a2.5 2.5 0 0 1 5 0V7"
                              stroke="currentColor"
                              strokeWidth="1.25"
                              strokeLinecap="round"
                            />
                            <rect
                              x="4"
                              y="7"
                              width="8"
                              height="6"
                              rx="1.5"
                              stroke="currentColor"
                              strokeWidth="1.25"
                            />
                          </svg>
                        </span>
                      ) : null}
                      {day}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
