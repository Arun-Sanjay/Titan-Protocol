"use client";

import * as React from "react";
import Link from "next/link";

import { db } from "../../../../../lib/db";
import {
  addSkillSession,
  getEngineByName,
  getPrimaryCycle,
  getSkills,
  getTodaysSkillMinutes,
  getWeeklySkillMinutes,
  setActiveSkill,
} from "../../../../../lib/api";

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatClock(totalSeconds: number): string {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SkillPage() {
  const [engineId, setEngineId] = React.useState<number | null>(null);
  const [cycleId, setCycleId] = React.useState<number | null>(null);
  const [active, setActive] = React.useState<boolean>(false);
  const [skills, setSkills] = React.useState<Awaited<ReturnType<typeof getSkills>>>([]);
  const [selectedSkillId, setSelectedSkillId] = React.useState<number | null>(null);
  const [newSkillName, setNewSkillName] = React.useState<string>("");
  const [manualMinutes, setManualMinutes] = React.useState<string>("30");
  const [todayMinutes, setTodayMinutes] = React.useState<number>(0);
  const [weeklyMinutes, setWeeklyMinutes] = React.useState<Array<{ date: string; minutes: number }>>([]);
  const [hitDays, setHitDays] = React.useState<number>(0);
  const [timerSeconds, setTimerSeconds] = React.useState<number>(0);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [timerStartedAt, setTimerStartedAt] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const engine = await getEngineByName("money");
      if (!engine?.id || !engine.is_active) {
        setActive(false);
        setEngineId(null);
        setCycleId(null);
        setSkills([]);
        setWeeklyMinutes([]);
        setTodayMinutes(0);
        setHitDays(0);
        return;
      }

      const [primaryCycle, nextSkills, today, weekly, allSessions] = await Promise.all([
        getPrimaryCycle(engine.id),
        getSkills(engine.id),
        getTodaysSkillMinutes(engine.id),
        getWeeklySkillMinutes(engine.id),
        db.skill_sessions.where("engine_id").equals(engine.id).toArray(),
      ]);

      const perDay = new Map<string, number>();
      for (const session of allSessions) {
        perDay.set(session.date, (perDay.get(session.date) ?? 0) + session.minutes);
      }

      setActive(true);
      setEngineId(engine.id);
      setCycleId(primaryCycle?.id ?? null);
      setSkills(nextSkills);
      setSelectedSkillId((current) => current ?? nextSkills[0]?.id ?? null);
      setTodayMinutes(today);
      setWeeklyMinutes(weekly);
      setHitDays([...perDay.values()].filter((minutes) => minutes >= 30).length);
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
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => {
      setTimerSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  async function handleCreateSkill() {
    if (!engineId || !newSkillName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const skill = await setActiveSkill(engineId, newSkillName);
      setNewSkillName("");
      setSelectedSkillId(skill.id as number);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddManual() {
    if (!engineId || !selectedSkillId) return;
    const minutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    setBusy(true);
    setError(null);
    try {
      await addSkillSession({
        engine_id: engineId,
        cycle_id: cycleId,
        skill_id: selectedSkillId,
        date: todayDateString(),
        minutes,
        mode: "manual",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleTimerToggle() {
    if (!isRunning) {
      setTimerStartedAt(Date.now());
      setIsRunning(true);
      return;
    }

    if (!engineId || !selectedSkillId || !timerStartedAt) {
      setIsRunning(false);
      return;
    }

    setBusy(true);
    setError(null);
    setIsRunning(false);
    try {
      const minutes = Math.max(1, Math.round(timerSeconds / 60));
      await addSkillSession({
        engine_id: engineId,
        cycle_id: cycleId,
        skill_id: selectedSkillId,
        date: todayDateString(),
        minutes,
        mode: "timer",
        started_at: timerStartedAt,
        ended_at: Date.now(),
      });
      setTimerSeconds(0);
      setTimerStartedAt(null);
      await load();
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
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Money Skill Tool</h1>
          <p className="mt-2 text-sm text-white/70">Track minutes locally with timer or manual logs.</p>
        </div>
        <Link href="/os/money" className="hud-btn px-3 py-1.5 text-sm text-white">
          Back to Money
        </Link>
      </header>

      {loading ? <p className="text-white/75">Loading skill tool...</p> : null}
      {!loading && error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
      ) : null}

      {!loading && !error && !active ? (
        <div className="hud-panel p-5">
          <p className="text-white/80">Money engine is inactive.</p>
          <Link href="/os/money" className="hud-btn mt-4 inline-flex px-3 py-1.5 text-sm text-white">
            Open Money Engine
          </Link>
        </div>
      ) : null}

      {!loading && !error && active ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Skill Selector</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <select
                  value={selectedSkillId ?? ""}
                  onChange={(event) => setSelectedSkillId(Number.parseInt(event.target.value, 10))}
                  className="hud-btn min-w-52 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Select Skill</option>
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newSkillName}
                  onChange={(event) => setNewSkillName(event.target.value)}
                  className="hud-btn min-w-52 flex-1 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Create new skill"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleCreateSkill()}
                  className="hud-btn px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Skill
                </button>
              </div>
            </div>

            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Timer</p>
              <p className="mt-4 text-5xl font-semibold text-white">{formatClock(timerSeconds)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !selectedSkillId}
                  onClick={() => void handleTimerToggle()}
                  className="hud-btn px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunning ? "Stop & Save" : "Start"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setIsRunning(false);
                    setTimerSeconds(0);
                    setTimerStartedAt(null);
                  }}
                  className="hud-btn px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Manual Log</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  value={manualMinutes}
                  onChange={(event) => setManualMinutes(event.target.value)}
                  className="hud-btn w-32 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Minutes"
                />
                <button
                  type="button"
                  disabled={busy || !selectedSkillId}
                  onClick={() => void handleAddManual()}
                  className="hud-btn px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add Minutes
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Today</p>
              <p className="mt-2 text-3xl font-semibold text-white">{todayMinutes} min</p>
              <p className="mt-1 text-sm text-white/70">All skills combined today</p>
              <p className="mt-4 text-sm text-white/75">30m hit days: {hitDays}</p>
            </div>

            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Weekly Summary</p>
              <div className="mt-4 space-y-3">
                {weeklyMinutes.map((item) => (
                  <div key={item.date}>
                    <div className="mb-1 flex items-center justify-between text-xs text-white/70">
                      <span>{item.date.slice(5)}</span>
                      <span>{item.minutes} min</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white/70"
                        style={{ width: `${Math.min(100, item.minutes)}%` }}
                      />
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
