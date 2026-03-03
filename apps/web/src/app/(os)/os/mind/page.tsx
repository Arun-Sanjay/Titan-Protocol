"use client";

import * as React from "react";

import { BodyCalendar } from "../../../../components/body/BodyCalendar";
import { BodyMonthlyHeatBars } from "../../../../components/body/BodyMonthlyHeatBars";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function MindPage() {
  const today = React.useMemo(() => new Date(), []);
  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => toDateKey(today));
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(() => startOfMonth(today));

  React.useEffect(() => {
    if (!selectedDateKey) return;
    const selectedDate = parseDateKey(selectedDateKey);
    if (
      selectedDate.getFullYear() !== visibleMonth.getFullYear() ||
      selectedDate.getMonth() !== visibleMonth.getMonth()
    ) {
      setVisibleMonth(startOfMonth(selectedDate));
    }
  }, [selectedDateKey, visibleMonth]);

  const emptyScoreMap = React.useMemo(() => ({} as Record<string, number>), []);

  const emptyConsistency = {
    consistencyPct: 0,
    consistentDays: 0,
    daysElapsed: 0,
    currentStreak: 0,
    bestStreak: 0,
  };

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-6">
        <header>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">MIND ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Forever tracker • {selectedDateKey}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/65">
            <span className="body-consistency-label">Selected</span>
            <input
              type="date"
              value={selectedDateKey}
              onChange={(event) => setSelectedDateKey(event.target.value)}
              className="body-select h-8 px-2"
            />
          </div>
        </header>

        <section className="tp-panel p-4">
          <p className="tp-kicker">Day Score</p>
          <p className="tp-score-value text-3xl">0%</p>
          <p className="mt-2 text-xs text-white/65">Main 0/0 • Secondary 0/0 • Points 0/0</p>
          <div className="tp-progress mt-3">
            <span style={{ width: "0%" }} />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <BodyCalendar
          selectedDateKey={selectedDateKey}
          onSelectDate={setSelectedDateKey}
          startDateKey={selectedDateKey}
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          scoreMap={emptyScoreMap}
          referenceDateKey={selectedDateKey}
        />

        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Consistency</p>
          <p className="tp-score-value text-3xl mt-2">{emptyConsistency.consistencyPct}%</p>
          <div className="body-consistency-stack">
            <div className="body-consistency-row">
              <p className="body-consistency-label">Consistent Days</p>
              <p className="body-consistency-value">
                {emptyConsistency.consistentDays} / {emptyConsistency.daysElapsed}
              </p>
            </div>
            <div className="body-consistency-row">
              <p className="body-consistency-label">Current Streak</p>
              <p className="body-consistency-value">{emptyConsistency.currentStreak} days</p>
            </div>
            <div className="body-consistency-row">
              <p className="body-consistency-label">Best Streak</p>
              <p className="body-consistency-value">{emptyConsistency.bestStreak} days</p>
            </div>
          </div>
          <div className="mt-4">
            <BodyMonthlyHeatBars
              visibleMonth={visibleMonth}
              scoreMap={emptyScoreMap}
              startDateKey={selectedDateKey}
              todayKey={selectedDateKey}
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Secondary Tasks</p>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>
          <div className="body-empty mt-4">No Mind tasks yet. Add your first task.</div>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Main Tasks</p>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>
          <div className="body-empty mt-4">No Mind tasks yet. Add your first task.</div>
        </section>
      </div>
    </main>
  );
}
