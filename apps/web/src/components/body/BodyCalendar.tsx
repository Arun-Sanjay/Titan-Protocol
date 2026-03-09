"use client";

import * as React from "react";

import { getBodyScoreMapForRange } from "../../lib/body";

type BodyCalendarProps = {
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  refreshKey?: number;
  startDateKey?: string;
  referenceDateKey?: string;
  visibleMonth?: Date;
  onVisibleMonthChange?: (next: Date) => void;
  scoreMap?: Record<string, number>;
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

export function BodyCalendar({
  selectedDateKey,
  onSelectDate,
  refreshKey,
  startDateKey,
  referenceDateKey,
  visibleMonth,
  onVisibleMonthChange,
  scoreMap: scoreMapProp,
}: BodyCalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const [internalMonth, setInternalMonth] = React.useState<Date>(() => startOfMonth(today));
  const [scoreMapState, setScoreMapState] = React.useState<Record<string, number>>({});
  const month = visibleMonth ?? internalMonth;
  const setMonth = onVisibleMonthChange ?? setInternalMonth;
  const scoreMap = scoreMapProp ?? scoreMapState;

  const monthLabel = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const totalDays = getDaysInMonth(month);
  const monthStartKey = toDateKey(startOfMonth(month));
  const monthEndKey = toDateKey(endOfMonth(month));
  const todayKey = toDateKey(today);
  const referenceKey = referenceDateKey ?? todayKey;

  React.useEffect(() => {
    if (scoreMapProp) return;
    let mounted = true;
    async function load() {
      const map = await getBodyScoreMapForRange(monthStartKey, monthEndKey);
      if (mounted) setScoreMapState(map);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [monthStartKey, monthEndKey, refreshKey, scoreMapProp]);

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

  function handlePrevMonth() {
    setMonth(addMonths(month, -1));
  }

  function handleNextMonth() {
    const next = addMonths(month, 1);
    if (next.getFullYear() > today.getFullYear()) return;
    if (next.getFullYear() === today.getFullYear() && next.getMonth() > today.getMonth()) return;
    setMonth(next);
  }

  const days = React.useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
      const dateKey = toDateKey(date);
      const isFuture = dateKey > referenceKey;
      const isSelected = dateKey === selectedDateKey;
      const isBeforeStart = startDateKey ? dateKey < startDateKey : false;
      const scorePct = scoreMap[dateKey] ?? 0;
      const visual = getDayVisual(dateKey, scorePct, isFuture, isBeforeStart);
      return { dateKey, day: i + 1, isFuture, isSelected, isBeforeStart, scorePct, visual };
    });
  }, [month, referenceKey, scoreMap, selectedDateKey, startDateKey, totalDays]);

  return (
    <section className="tx-panel tx-panel--subtle p-3">
      <div className="tp-panel-head">
        <div>
          <p className="tx-kicker">Calendar</p>
          <p className="tx-muted">{monthLabel}</p>
        </div>
        <div className="tx-calendar-actions">
          <button type="button" className="tx-btn tx-btn--ghost tx-btn--compact" onClick={handlePrevMonth}>
            Prev
          </button>
          <button type="button" className="tx-btn tx-btn--ghost tx-btn--compact" onClick={handleNextMonth}>
            Next
          </button>
        </div>
      </div>

      <div className="body-calendar mt-3">
        {days.map((day) => {
          const classNames = [
            "body-day",
            day.visual.state === "grey" ? "day-grey" : "",
            day.visual.state === "red" ? "day-red" : "",
            day.visual.state === "yellow" ? "day-yellow" : "",
            day.visual.state === "green" ? "day-green" : "",
            day.isSelected ? "is-selected" : "",
            day.isFuture || day.isBeforeStart ? "is-disabled" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day.dateKey}
              type="button"
              className={classNames}
              style={{ ["--heat" as never]: day.visual.intensity }}
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
