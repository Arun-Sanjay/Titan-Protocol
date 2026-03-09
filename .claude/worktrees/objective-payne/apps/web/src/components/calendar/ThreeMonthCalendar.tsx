"use client";

import * as React from "react";

type ThreeMonthCalendarProps = {
  selectedDateISO: string;
  onSelect: (dateISO: string) => void;
  monthOffset: number;
  onMonthOffsetChange: (next: number) => void;
  scoreByDate: Record<string, number>;
  startDateISO: string;
  todayISO: string;
};

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getDayVisual(scorePct: number, isFuture: boolean, isBeforeStart: boolean) {
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

export function ThreeMonthCalendar({
  selectedDateISO,
  onSelect,
  monthOffset,
  onMonthOffsetChange,
  scoreByDate,
  startDateISO,
  todayISO,
}: ThreeMonthCalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const centerMonth = addMonths(startOfMonth(today), monthOffset);
  const months = [addMonths(centerMonth, -1), centerMonth, addMonths(centerMonth, 1)];

  return (
    <section className="tp-panel p-3">
      <div className="tp-panel-head">
        <div>
          <p className="tp-kicker">Calendar</p>
          <p className="tp-muted">3 months</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="tp-button tp-button-inline" onClick={() => onMonthOffsetChange(monthOffset - 1)}>
            Prev
          </button>
          <button type="button" className="tp-button tp-button-inline" onClick={() => onMonthOffsetChange(monthOffset + 1)}>
            Next
          </button>
        </div>
      </div>

      <div className="cc-calendar mt-3 lg:grid-cols-3">
        {months.map((month) => {
          const totalDays = daysInMonth(month);
          const monthLabel = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
          const firstDayIndex = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
          const blanks = Array.from({ length: firstDayIndex }, (_, i) => `blank-${monthLabel}-${i}`);

          return (
            <div key={monthLabel} className="cc-month">
              <div className="cc-month-header">
                <p className="cc-month-title">{monthLabel}</p>
              </div>
              <div className="cc-calendar-grid">
                {blanks.map((key) => (
                  <span key={key} className="body-day is-disabled" aria-hidden="true" />
                ))}
                {Array.from({ length: totalDays }, (_, i) => {
                  const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
                  const dateKey = toDateKey(date);
                  const isFuture = dateKey > todayISO;
                  const isBeforeStart = dateKey < startDateISO;
                  const scorePct = scoreByDate[dateKey] ?? 0;
                  const visual = getDayVisual(scorePct, isFuture, isBeforeStart);
                  const isSelected = dateKey === selectedDateISO;
                  const classNames = [
                    "body-day",
                    visual.state === "grey" ? "day-grey" : "",
                    visual.state === "red" ? "day-red" : "",
                    visual.state === "yellow" ? "day-yellow" : "",
                    visual.state === "green" ? "day-green" : "",
                    isSelected ? "is-selected" : "",
                    isFuture || isBeforeStart ? "is-disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      className={classNames}
                      style={{ ["--heat" as never]: visual.intensity }}
                      onClick={() => onSelect(dateKey)}
                      disabled={isFuture || isBeforeStart}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
