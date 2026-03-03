"use client";

import * as React from "react";

import { getBodyCompletionMapForRange } from "../../lib/body";

type BodyCalendarProps = {
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  refreshKey?: number;
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

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getDaysInMonth(date: Date): number {
  return endOfMonth(date).getDate();
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function BodyCalendar({ selectedDateKey, onSelectDate, refreshKey }: BodyCalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => startOfMonth(today));
  const [completionMap, setCompletionMap] = React.useState<Record<string, boolean>>({});

  const monthLabel = `${MONTH_NAMES[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  const totalDays = getDaysInMonth(visibleMonth);
  const monthStartKey = toDateKey(startOfMonth(visibleMonth));
  const monthEndKey = toDateKey(endOfMonth(visibleMonth));
  const todayKey = toDateKey(today);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const map = await getBodyCompletionMapForRange(monthStartKey, monthEndKey);
      if (mounted) setCompletionMap(map);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [monthStartKey, monthEndKey, refreshKey]);

  function handlePrevMonth() {
    setVisibleMonth((prev) => addMonths(prev, -1));
  }

  function handleNextMonth() {
    const next = addMonths(visibleMonth, 1);
    if (next.getFullYear() > today.getFullYear()) return;
    if (next.getFullYear() === today.getFullYear() && next.getMonth() > today.getMonth()) return;
    setVisibleMonth(next);
  }

  const days = React.useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), i + 1);
      const dateKey = toDateKey(date);
      const isFuture = dateKey > todayKey;
      const isSelected = dateKey === selectedDateKey;
      const hasCompleted = completionMap[dateKey] === true;
      return { dateKey, day: i + 1, isFuture, isSelected, hasCompleted };
    });
  }, [completionMap, selectedDateKey, totalDays, visibleMonth, todayKey]);

  return (
    <section className="tp-panel p-5 sm:p-6">
      <div className="tp-panel-head">
        <div>
          <p className="tp-kicker">Calendar</p>
          <p className="tp-muted">{monthLabel}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="tp-button tp-button-inline" onClick={handlePrevMonth}>
            Prev
          </button>
          <button type="button" className="tp-button tp-button-inline" onClick={handleNextMonth}>
            Next
          </button>
        </div>
      </div>

      <div className="body-calendar mt-4">
        {days.map((day) => {
          const classNames = [
            "body-day",
            day.isFuture ? "is-future" : "is-available",
            day.hasCompleted ? "is-green" : "is-grey",
            day.isSelected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day.dateKey}
              type="button"
              disabled={day.isFuture}
              className={classNames}
              onClick={() => onSelectDate(day.dateKey)}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </section>
  );
}
