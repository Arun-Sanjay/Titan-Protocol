"use client";

import * as React from "react";
import {
  addDaysISO,
  assertDateISO,
  dateFromISO,
  dateToISO,
  monthBounds,
  todayISO,
} from "@/lib/date";

export type DateNavigationState = {
  /** Today's date key, stable for the lifetime of the component. */
  todayKey: string;
  /** The currently selected date key (YYYY-MM-DD). */
  selectedDateKey: string;
  setSelectedDateKey: (dateKey: string) => void;
  /** The month currently displayed in the calendar (first day of month as Date). */
  visibleMonth: Date;
  setVisibleMonth: (date: Date) => void;
  /** First day of the visible month as a DateISO string. */
  monthStartKey: string;
  /** Last day of the visible month as a DateISO string. */
  monthEndKey: string;
  /** Change handler — validates the incoming string before setting. */
  handleDateChange: (nextDateKey: string) => void;
};

/**
 * Shared date navigation state for engine pages (Body, Mind, Money, General).
 *
 * @param storageKey  localStorage key used to persist the selected date across page loads.
 *                    Each engine should use its own key (e.g. "body.selectedDateISO").
 */
export function useDateNavigation(storageKey: string): DateNavigationState {
  const todayKey = React.useMemo(() => todayISO(), []);

  const [selectedDateKey, setSelectedDateKeyRaw] = React.useState<string>(() => todayKey);
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() =>
    dateFromISO(monthBounds(todayKey).start),
  );

  // Restore persisted selected date on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      setSelectedDateKeyRaw(assertDateISO(stored));
    } catch {
      // Stored value was corrupt — silently fall back to today.
    }
  }, [storageKey]);

  // Persist selected date whenever it changes.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, selectedDateKey);
  }, [storageKey, selectedDateKey]);

  // Keep the visible calendar month in sync with the selected date.
  React.useEffect(() => {
    let safeDate: string;
    try {
      safeDate = assertDateISO(selectedDateKey);
    } catch {
      return;
    }
    const selectedMonthStart = monthBounds(safeDate).start;
    const visibleMonthStart = monthBounds(dateToISO(visibleMonth)).start;
    if (selectedMonthStart !== visibleMonthStart) {
      setVisibleMonth(dateFromISO(selectedMonthStart));
    }
  }, [selectedDateKey, visibleMonth]);

  const monthStartKey = React.useMemo(
    () => monthBounds(dateToISO(visibleMonth)).start,
    [visibleMonth],
  );
  const monthEndKey = React.useMemo(
    () => addDaysISO(monthBounds(dateToISO(visibleMonth)).end, -1),
    [visibleMonth],
  );

  function setSelectedDateKey(dateKey: string) {
    try {
      setSelectedDateKeyRaw(assertDateISO(dateKey));
    } catch {
      setSelectedDateKeyRaw(todayISO());
    }
  }

  function handleDateChange(nextDateKey: string) {
    if (!nextDateKey) return;
    setSelectedDateKey(nextDateKey);
  }

  return {
    todayKey,
    selectedDateKey,
    setSelectedDateKey,
    visibleMonth,
    setVisibleMonth,
    monthStartKey,
    monthEndKey,
    handleDateChange,
  };
}
