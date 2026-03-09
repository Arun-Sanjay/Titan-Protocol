"use client";

import * as React from "react";
import Link from "next/link";

import { assertDateISO, todayISO } from "../../../../../lib/date";
import {
  getPomodoroDay,
  getPomodoroSettings,
  incrementPomodoroDayCompleted,
  savePomodoroSettings,
} from "../../../../../lib/pomodoro";

type Mode = "focus" | "break" | "long";

function formatTime(totalSeconds: number) {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  const seconds = Math.max(0, totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch (err) {
    console.warn("Pomodoro beep failed", err);
  }
}

export default function MindFocusPage() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => todayKey);
  const [settings, setSettings] = React.useState({
    focusMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    longBreakAfter: 4,
    dailyTarget: 4,
  });
  const [completedToday, setCompletedToday] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = React.useState(settings.focusMinutes * 60);
  const [isRunning, setIsRunning] = React.useState(false);
  const [focusSinceLong, setFocusSinceLong] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      const next = await getPomodoroSettings();
      if (!mounted) return;
      setSettings({
        focusMinutes: next.focusMinutes,
        breakMinutes: next.breakMinutes,
        longBreakMinutes: next.longBreakMinutes,
        longBreakAfter: next.longBreakAfter,
        dailyTarget: next.dailyTarget,
      });
      if (!isRunning) {
        const nextSeconds =
          mode === "focus"
            ? next.focusMinutes * 60
            : mode === "break"
            ? next.breakMinutes * 60
            : next.longBreakMinutes * 60;
        setSecondsLeft(nextSeconds);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, [isRunning, mode]);

  React.useEffect(() => {
    let mounted = true;
    async function loadDaily() {
      const daily = await getPomodoroDay(selectedDateKey);
      if (!mounted) return;
      setCompletedToday(daily.completed);
    }
    loadDaily();
    return () => {
      mounted = false;
    };
  }, [selectedDateKey]);

  React.useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  React.useEffect(() => {
    if (!isRunning) return;
    if (secondsLeft > 0) return;
    async function handleComplete() {
      setIsRunning(false);
      playBeep();
      if (mode === "focus") {
        await incrementPomodoroDayCompleted(selectedDateKey, 1);
        setCompletedToday((prev) => prev + 1);
        const nextCount = focusSinceLong + 1;
        setFocusSinceLong(nextCount);
        const nextMode = nextCount % settings.longBreakAfter === 0 ? "long" : "break";
        setMode(nextMode);
        const nextSeconds = nextMode === "long" ? settings.longBreakMinutes * 60 : settings.breakMinutes * 60;
        setSecondsLeft(nextSeconds);
        return;
      }
      setMode("focus");
      setSecondsLeft(settings.focusMinutes * 60);
    }
    handleComplete();
  }, [secondsLeft, isRunning, mode, focusSinceLong, settings, selectedDateKey]);

  function handleDateChange(nextDate: string) {
    if (!nextDate) return;
    try {
      setSelectedDateKey(assertDateISO(nextDate));
    } catch (err) {
      console.error(err);
      setSelectedDateKey(todayISO());
    }
  }

  const targetReached = settings.dailyTarget > 0 ? completedToday >= settings.dailyTarget : false;

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/os/mind" className="tp-button tp-button-inline">
            ← Mind
          </Link>
          <div>
            <h1 className="tp-title text-3xl font-bold md:text-4xl">Focus Timer</h1>
            <p className="tp-subtitle mt-2 text-sm text-white/70">Pomodoro focus sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/65">
          <span className="body-consistency-label">Selected</span>
          <input type="date" value={selectedDateKey} onChange={(e) => handleDateChange(e.target.value)} className="body-select h-8 px-2" />
        </div>
      </div>

      <section className="tp-panel mt-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="tp-kicker">Pomodoros Today</p>
            <p className="tp-score-value text-3xl mt-2">
              {completedToday} / {settings.dailyTarget}
            </p>
            <p className="mt-2 text-xs text-white/65">
              {targetReached ? "Target reached" : "Keep going"}
            </p>
          </div>
          <div className="tp-progress w-48">
            <span style={{ width: settings.dailyTarget === 0 ? "0%" : `${Math.min(100, (completedToday / settings.dailyTarget) * 100)}%` }} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-6">
          <div className="text-5xl font-semibold tracking-[0.2em] text-white/90">{formatTime(secondsLeft)}</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["focus", "break", "long"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setIsRunning(false);
                  const nextSeconds =
                    item === "focus"
                      ? settings.focusMinutes * 60
                      : item === "break"
                      ? settings.breakMinutes * 60
                      : settings.longBreakMinutes * 60;
                  setSecondsLeft(nextSeconds);
                }}
                className={`tp-button tp-button-inline ${mode === item ? "is-active" : ""}`}
              >
                {item === "focus" ? "Focus" : item === "break" ? "Break" : "Long Break"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsRunning((prev) => !prev)} className="tp-button w-auto px-4">
            {isRunning ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              const resetSeconds =
                mode === "focus"
                  ? settings.focusMinutes * 60
                  : mode === "break"
                  ? settings.breakMinutes * 60
                  : settings.longBreakMinutes * 60;
              setSecondsLeft(resetSeconds);
            }}
            className="tp-button w-auto px-4"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={async () => {
              setIsRunning(false);
              if (mode === "focus") {
                await incrementPomodoroDayCompleted(selectedDateKey, 1);
                setCompletedToday((prev) => prev + 1);
                const nextCount = focusSinceLong + 1;
                setFocusSinceLong(nextCount);
                const nextMode = nextCount % settings.longBreakAfter === 0 ? "long" : "break";
                setMode(nextMode);
                const nextSeconds = nextMode === "long" ? settings.longBreakMinutes * 60 : settings.breakMinutes * 60;
                setSecondsLeft(nextSeconds);
                return;
              }
              setMode("focus");
              setSecondsLeft(settings.focusMinutes * 60);
            }}
            className="tp-button w-auto px-4"
          >
            Skip
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-white/70">
          <label className="flex flex-col gap-2">
            Focus Minutes
            <input
              type="number"
              min={1}
              value={settings.focusMinutes}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, focusMinutes: Number(event.target.value) || 1 }))
              }
              onBlur={async () => {
                const next = await savePomodoroSettings({ focusMinutes: settings.focusMinutes });
                setSettings({
                  focusMinutes: next.focusMinutes,
                  breakMinutes: next.breakMinutes,
                  longBreakMinutes: next.longBreakMinutes,
                  longBreakAfter: next.longBreakAfter,
                  dailyTarget: next.dailyTarget,
                });
                if (mode === "focus" && !isRunning) {
                  setSecondsLeft(next.focusMinutes * 60);
                }
              }}
              className="body-input h-9"
            />
          </label>
          <label className="flex flex-col gap-2">
            Break Minutes
            <input
              type="number"
              min={1}
              value={settings.breakMinutes}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, breakMinutes: Number(event.target.value) || 1 }))
              }
              onBlur={async () => {
                const next = await savePomodoroSettings({ breakMinutes: settings.breakMinutes });
                setSettings({
                  focusMinutes: next.focusMinutes,
                  breakMinutes: next.breakMinutes,
                  longBreakMinutes: next.longBreakMinutes,
                  longBreakAfter: next.longBreakAfter,
                  dailyTarget: next.dailyTarget,
                });
                if (mode === "break" && !isRunning) {
                  setSecondsLeft(next.breakMinutes * 60);
                }
              }}
              className="body-input h-9"
            />
          </label>
          <label className="flex flex-col gap-2">
            Long Break Minutes
            <input
              type="number"
              min={1}
              value={settings.longBreakMinutes}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, longBreakMinutes: Number(event.target.value) || 1 }))
              }
              onBlur={async () => {
                const next = await savePomodoroSettings({ longBreakMinutes: settings.longBreakMinutes });
                setSettings({
                  focusMinutes: next.focusMinutes,
                  breakMinutes: next.breakMinutes,
                  longBreakMinutes: next.longBreakMinutes,
                  longBreakAfter: next.longBreakAfter,
                  dailyTarget: next.dailyTarget,
                });
                if (mode === "long" && !isRunning) {
                  setSecondsLeft(next.longBreakMinutes * 60);
                }
              }}
              className="body-input h-9"
            />
          </label>
          <label className="flex flex-col gap-2">
            Long Break After
            <input
              type="number"
              min={1}
              value={settings.longBreakAfter}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, longBreakAfter: Number(event.target.value) || 1 }))
              }
              onBlur={async () => {
                const next = await savePomodoroSettings({ longBreakAfter: settings.longBreakAfter });
                setSettings({
                  focusMinutes: next.focusMinutes,
                  breakMinutes: next.breakMinutes,
                  longBreakMinutes: next.longBreakMinutes,
                  longBreakAfter: next.longBreakAfter,
                  dailyTarget: next.dailyTarget,
                });
              }}
              className="body-input h-9"
            />
          </label>
          <label className="flex flex-col gap-2">
            Daily Target
            <input
              type="number"
              min={0}
              value={settings.dailyTarget}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, dailyTarget: Number(event.target.value) || 0 }))
              }
              onBlur={async () => {
                const next = await savePomodoroSettings({ dailyTarget: settings.dailyTarget });
                setSettings({
                  focusMinutes: next.focusMinutes,
                  breakMinutes: next.breakMinutes,
                  longBreakMinutes: next.longBreakMinutes,
                  longBreakAfter: next.longBreakAfter,
                  dailyTarget: next.dailyTarget,
                });
              }}
              className="body-input h-9"
            />
          </label>
        </div>
      </section>
    </main>
  );
}
