"use client";

import * as React from "react";

export type HabitGridCell = {
  dateKey: string;
  count: number;
  max: number;
};

type HabitGridProps = {
  logs: HabitGridCell[];
  weeks?: number;
};

const CELL_SIZE = 14;
const CELL_GAP = 2;
const DAY_LABELS = ["", "M", "", "W", "", "F", ""];
const ACCENT = "#34d399";

export default function HabitGrid({ logs, weeks = 12 }: HabitGridProps) {
  // Build a lookup map: dateKey -> { count, max }
  const logMap = React.useMemo(() => {
    const map = new Map<string, { count: number; max: number }>();
    for (const l of logs) {
      map.set(l.dateKey, { count: l.count, max: l.max });
    }
    return map;
  }, [logs]);

  // Generate the grid: 12 weeks x 7 days, ending today
  const grid = React.useMemo(() => {
    const totalDays = weeks * 7;
    const today = new Date();
    // Align to end on today's column
    // Grid columns = weeks, rows = 7 (Sun=0 through Sat=6)
    // We want the last column to end on today
    const todayDow = today.getDay(); // 0=Sun
    const endDate = new Date(today);

    // Build columns from right to left
    const columns: { dateKey: string; count: number; max: number }[][] = [];

    // Start from today, go back totalDays - 1 days
    // Last column: today's day-of-week determines how many cells are in the last column
    // Actually, we fill a full grid and just mark future cells as empty.

    // Calculate the start date: go back enough to fill weeks*7 cells, aligned by week
    // The grid starts on a Sunday. End date = today.
    // Last column ends on Saturday >= today
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (6 - todayDow)); // next Saturday
    const startDate = new Date(endOfWeek);
    startDate.setDate(startDate.getDate() - (weeks * 7 - 1));

    const cursor = new Date(startDate);
    for (let w = 0; w < weeks; w++) {
      const col: { dateKey: string; count: number; max: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = dateToISO(cursor);
        const isFuture = cursor > today;
        if (isFuture) {
          col.push({ dateKey: key, count: -1, max: 0 }); // -1 = no data / future
        } else {
          const entry = logMap.get(key);
          col.push({
            dateKey: key,
            count: entry?.count ?? 0,
            max: entry?.max ?? 1,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      columns.push(col);
    }

    return columns;
  }, [logMap, weeks]);

  return (
    <div className="flex gap-1">
      {/* Day labels column */}
      <div
        className="flex flex-col shrink-0"
        style={{ gap: CELL_GAP }}
      >
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="flex items-center justify-end pr-1"
            style={{
              width: 16,
              height: CELL_SIZE,
              fontSize: 9,
              color: "rgba(255,255,255,0.35)",
              lineHeight: 1,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid columns */}
      <div className="flex" style={{ gap: CELL_GAP }}>
        {grid.map((col, colIdx) => (
          <div
            key={colIdx}
            className="flex flex-col"
            style={{ gap: CELL_GAP }}
          >
            {col.map((cell, rowIdx) => {
              let bg = "rgba(255,255,255,0.03)";
              if (cell.count > 0 && cell.max > 0) {
                // Opacity ranges from 0.4 (1 habit) to 1.0 (all habits)
                const ratio = Math.min(cell.count / cell.max, 1);
                const opacity = 0.4 + 0.6 * ratio;
                bg = `rgba(52, 211, 153, ${opacity})`;
              } else if (cell.count === -1) {
                // Future cell
                bg = "rgba(255,255,255,0.015)";
              }

              return (
                <div
                  key={rowIdx}
                  title={`${cell.dateKey}: ${cell.count === -1 ? "—" : cell.count} completed`}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: 3,
                    backgroundColor: bg,
                    transition: "background-color 150ms ease",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
