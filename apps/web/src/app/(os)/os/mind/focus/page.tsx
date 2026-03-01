"use client";

import * as React from "react";
import Link from "next/link";

import { addMindFocusSession, getActiveMindProgram, getMindFocusStats } from "../../../../../lib/api";
import { playComplete } from "../../../../../lib/sound";

function formatClock(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function toIsoFromMs(value: number): string {
  return new Date(value).toISOString();
}

export default function MindFocusPage() {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [programId, setProgramId] = React.useState<number | null>(null);
  const [targetMinutes, setTargetMinutes] = React.useState(0);
  const [timerSeconds, setTimerSeconds] = React.useState(0);
  const [timerRunning, setTimerRunning] = React.useState(false);
  const [timerStartedAtMs, setTimerStartedAtMs] = React.useState<number | null>(null);
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof getMindFocusStats>> | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveMindProgram();
      if (!active?.id) {
        setProgramId(null);
        setStats(null);
        setTargetMinutes(0);
        return;
      }
      const focusStats = await getMindFocusStats(active.id);
      setProgramId(active.id);
      setTargetMinutes(active.deep_work_target_min);
      setStats(focusStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => {
      if (!timerStartedAtMs) return;
      setTimerSeconds(Math.max(0, Math.floor((Date.now() - timerStartedAtMs) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerStartedAtMs]);

  function handleStart() {
    if (timerRunning) return;
    const startedAt = Date.now() - timerSeconds * 1000;
    setTimerStartedAtMs(startedAt);
    setTimerRunning(true);
    setMessage(null);
  }

  function handlePause() {
    setTimerRunning(false);
  }

  function handleReset() {
    setTimerRunning(false);
    setTimerStartedAtMs(null);
    setTimerSeconds(0);
  }

  async function handleEnd() {
    if (!programId) return;
    const durationMinutes = Math.max(1, Math.round(timerSeconds / 60));
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const startMs = timerStartedAtMs ?? Date.now() - timerSeconds * 1000;
      await addMindFocusSession({
        program_id: programId,
        start_time_iso: toIsoFromMs(startMs),
        end_time_iso: toIsoFromMs(Date.now()),
        duration_minutes: durationMinutes,
        interrupted: false,
      });
      playComplete();
      handleReset();
      await load();
      setMessage(`Session logged (${durationMinutes} min).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Mind Focus Tool</h1>
          <p className="mt-2 text-sm text-white/70">Deep work sessions are logged by date and feed your Mind consistency score.</p>
        </div>
        <Link href="/os/mind" className="hud-btn px-3 py-1.5 text-sm text-white">
          Back to Mind
        </Link>
      </header>

      {error ? <p className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
      {message ? <p className="mb-4 rounded-md border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</p> : null}
      {loading ? <p className="text-sm text-white/70">Loading focus tool...</p> : null}

      {!loading && !programId ? (
        <section className="hud-panel p-5">
          <p className="text-sm text-white/75">No active Mind cycle.</p>
          <p className="mt-2 text-xs text-white/60">Create your Mind cycle first, then return to this tool.</p>
          <Link href="/os/mind/setup" className="hud-btn mt-3 inline-flex px-3 py-1.5 text-sm text-white">
            Set Up Mind
          </Link>
        </section>
      ) : null}

      {!loading && programId ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="hud-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Focus Session</p>
            <p className="mt-2 text-sm text-white/70">Target {targetMinutes} minutes daily</p>
            <p className="mt-8 text-center text-6xl font-semibold text-white">{formatClock(timerSeconds)}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {!timerRunning ? (
                <button type="button" onClick={handleStart} className="hud-btn px-4 py-2 text-sm text-white">
                  Start
                </button>
              ) : (
                <button type="button" onClick={handlePause} className="hud-btn px-4 py-2 text-sm text-white">
                  Pause
                </button>
              )}
              <button type="button" onClick={() => void handleEnd()} disabled={busy} className="hud-btn px-4 py-2 text-sm text-white">
                End
              </button>
              <button type="button" onClick={handleReset} className="hud-btn px-4 py-2 text-sm text-white">
                Reset
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Today</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats?.todayMinutes ?? 0} min</p>
              <p className="mt-1 text-sm text-white/70">{stats?.todaySessions.length ?? 0} sessions</p>
            </div>

            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Last 7 Days</p>
              <div className="mt-4 space-y-3">
                {(stats?.daily ?? []).map((item) => (
                  <div key={item.date}>
                    <div className="mb-1 flex items-center justify-between text-xs text-white/75">
                      <span>{item.date.slice(5)}</span>
                      <span>{item.minutes} min • {item.sessions} sessions</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, item.minutes)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
