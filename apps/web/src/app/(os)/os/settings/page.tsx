"use client";

import * as React from "react";
import Link from "next/link";

import { db, TITAN_TABLES, type TitanBackup } from "../../../../lib/db";
import {
  archiveCycle,
  calculateCycleConsistency,
  createCycle,
  extendCycle,
  getEngines,
  getPrimaryCycle,
} from "../../../../lib/api";

async function exportBackup(): Promise<TitanBackup> {
  return {
    engines: await db.engines.toArray(),
    modules: await db.modules.toArray(),
    cycles: await db.cycles.toArray(),
    engine_tasks: await db.engine_tasks.toArray(),
    daily_logs: await db.daily_logs.toArray(),
    focus_sessions: await db.focus_sessions.toArray(),
    workouts: await db.workouts.toArray(),
    workout_exercises: await db.workout_exercises.toArray(),
    workout_sets: await db.workout_sets.toArray(),
    exercises: await db.exercises.toArray(),
    workout_templates: await db.workout_templates.toArray(),
    template_exercises: await db.template_exercises.toArray(),
    skills: await db.skills.toArray(),
    skill_sessions: await db.skill_sessions.toArray(),
    body_profiles: await db.body_profiles.toArray(),
    body_programs: await db.body_programs.toArray(),
    body_cycles: await db.body_cycles.toArray(),
    body_tasks: await db.body_tasks.toArray(),
    body_task_completions: await db.body_task_completions.toArray(),
    body_program_tasks: await db.body_program_tasks.toArray(),
    body_day_logs: await db.body_day_logs.toArray(),
    mind_programs: await db.mind_programs.toArray(),
    mind_tasks: await db.mind_tasks.toArray(),
    mind_day_logs: await db.mind_day_logs.toArray(),
    mind_journal_entries: await db.mind_journal_entries.toArray(),
    mind_focus_sessions: await db.mind_focus_sessions.toArray(),
    mind_rules: await db.mind_rules.toArray(),
    mind_rule_violations: await db.mind_rule_violations.toArray(),
    mind_weekly_reviews: await db.mind_weekly_reviews.toArray(),
    program_tasks: await db.program_tasks.toArray(),
    program_task_logs: await db.program_task_logs.toArray(),
    nutrition_targets: await db.nutrition_targets.toArray(),
    nutrition_logs: await db.nutrition_logs.toArray(),
    meals: await db.meals.toArray(),
    meal_logs: await db.meal_logs.toArray(),
    body_meals: await db.body_meals.toArray(),
    os_programs: await db.os_programs.toArray(),
    os_program_tasks: await db.os_program_tasks.toArray(),
    os_task_logs: await db.os_task_logs.toArray(),
    os_nutrition_logs: await db.os_nutrition_logs.toArray(),
  };
}

async function importBackup(payload: TitanBackup) {
  await db.transaction("rw", db.tables, async () => {
      for (const tableName of [...TITAN_TABLES].reverse()) {
        await db.table(tableName).clear();
      }

      await db.engines.bulkAdd(payload.engines);
      await db.modules.bulkAdd(payload.modules);
      await db.cycles.bulkAdd(payload.cycles);
      await db.engine_tasks.bulkAdd(payload.engine_tasks ?? []);
      await db.daily_logs.bulkAdd(payload.daily_logs);
      await db.focus_sessions.bulkAdd(payload.focus_sessions);
      await db.workouts.bulkAdd(payload.workouts);
      await db.workout_exercises.bulkAdd(payload.workout_exercises);
      await db.workout_sets.bulkAdd(payload.workout_sets);
      await db.exercises.bulkAdd(payload.exercises);
      await db.workout_templates.bulkAdd(payload.workout_templates);
      await db.template_exercises.bulkAdd(payload.template_exercises);
      await db.skills.bulkAdd(payload.skills);
      await db.skill_sessions.bulkAdd(payload.skill_sessions);
      await db.body_profiles.bulkAdd(payload.body_profiles);
      await db.body_programs.bulkAdd(payload.body_programs);
      await db.body_cycles.bulkAdd(payload.body_cycles);
      await db.body_tasks.bulkAdd(payload.body_tasks ?? []);
      await db.body_task_completions.bulkAdd(payload.body_task_completions ?? []);
      await db.body_program_tasks.bulkAdd(payload.body_program_tasks ?? []);
      await db.body_day_logs.bulkAdd(payload.body_day_logs ?? []);
      await db.mind_programs.bulkAdd(payload.mind_programs ?? []);
      await db.mind_tasks.bulkAdd(payload.mind_tasks ?? []);
      await db.mind_day_logs.bulkAdd(payload.mind_day_logs ?? []);
      await db.mind_journal_entries.bulkAdd(payload.mind_journal_entries ?? []);
      await db.mind_focus_sessions.bulkAdd(payload.mind_focus_sessions ?? []);
      await db.mind_rules.bulkAdd(payload.mind_rules ?? []);
      await db.mind_rule_violations.bulkAdd(payload.mind_rule_violations ?? []);
      await db.mind_weekly_reviews.bulkAdd(payload.mind_weekly_reviews ?? []);
      await db.program_tasks.bulkAdd(payload.program_tasks);
      await db.program_task_logs.bulkAdd(payload.program_task_logs);
      await db.nutrition_targets.bulkAdd(payload.nutrition_targets);
      await db.nutrition_logs.bulkAdd(payload.nutrition_logs);
      await db.meals.bulkAdd(payload.meals ?? []);
      await db.meal_logs.bulkAdd(payload.meal_logs ?? []);
      await db.body_meals.bulkAdd(payload.body_meals ?? []);
      await db.os_programs.bulkAdd(payload.os_programs ?? []);
      await db.os_program_tasks.bulkAdd(payload.os_program_tasks ?? []);
      await db.os_task_logs.bulkAdd(payload.os_task_logs ?? []);
      await db.os_nutrition_logs.bulkAdd(payload.os_nutrition_logs ?? []);
    });
}

export default function SettingsPage() {
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cycleBusy, setCycleBusy] = React.useState<number | null>(null);
  const [cycleRows, setCycleRows] = React.useState<
    Array<{
      engineId: number;
      engineName: string;
      cycleId: number | null;
      cycleTitle: string;
      cycleLength: number;
      cycleStartDate: string | null;
      dayIndex: number;
    }>
  >([]);
  const [newCycleLengthByEngine, setNewCycleLengthByEngine] = React.useState<Record<number, number>>({});

  const loadCycleRows = React.useCallback(async () => {
    const engines = await getEngines();
    const rows = await Promise.all(
      engines.map(async (engine) => {
        const primary = engine.id ? await getPrimaryCycle(engine.id) : null;
        const consistency = primary?.id ? await calculateCycleConsistency(primary.id) : null;
        return {
          engineId: engine.id as number,
          engineName: engine.name.toUpperCase(),
          cycleId: primary?.id ?? null,
          cycleTitle: primary?.title ?? "No active timeframe",
          cycleLength: primary?.duration_days ?? 0,
          cycleStartDate: primary?.start_date ?? null,
          dayIndex: consistency?.dayIndex ?? 0,
        };
      }),
    );
    setCycleRows(rows);
  }, []);

  React.useEffect(() => {
    void loadCycleRows();
  }, [loadCycleRows]);

  async function handleExport() {
    setError(null);
    setMessage(null);
    try {
      const payload = await exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `titan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Backup exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as TitanBackup;
      if (!window.confirm("Importing will wipe current local data. Continue?")) {
        return;
      }
      await importBackup(payload);
      setMessage("Backup imported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      event.target.value = "";
    }
  }

  function handleResetBootScreen() {
    try {
      window.localStorage.removeItem("tp_boot_seen_v1");
      setError(null);
      setMessage("Boot screen reset. Next time you open '/', boot intro will play.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleExtendCycle(cycleId: number, days: 30 | 60 | 90) {
    setCycleBusy(cycleId);
    setError(null);
    setMessage(null);
    try {
      await extendCycle(cycleId, days);
      await loadCycleRows();
      setMessage(`Timeframe extended by ${days} days.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCycleBusy(null);
    }
  }

  async function handleArchiveCycle(cycleId: number) {
    if (!window.confirm("End this timeframe now?")) return;
    setCycleBusy(cycleId);
    setError(null);
    setMessage(null);
    try {
      await archiveCycle(cycleId);
      await loadCycleRows();
      setMessage("Timeframe archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCycleBusy(null);
    }
  }

  async function handleCreateCycle(engineId: number, engineName: string) {
    const length = newCycleLengthByEngine[engineId] ?? 90;
    setCycleBusy(engineId);
    setError(null);
    setMessage(null);
    try {
      await createCycle(engineId, `${engineName} ${length}D Timeframe`, length, true);
      await loadCycleRows();
      setMessage(`New timeframe created (${length} days).`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (text.startsWith("ACTIVE_CYCLE_EXISTS")) {
        const [, cycleId = "?", cycleTitle = "Active timeframe"] = text.split(":");
        setError(`An active timeframe already exists (${cycleTitle}, #${cycleId}). Archive it before creating a new one.`);
      } else {
        setError(text);
      }
    } finally {
      setCycleBusy(null);
    }
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">OS Settings</h1>
          <p className="mt-2 text-sm text-white/70">Export or restore the complete local Titan Protocol database.</p>
        </div>
        <Link href="/os" className="hud-btn px-3 py-1.5 text-sm text-white">
          Back to Dashboard
        </Link>
      </header>

      <div className="hud-panel max-w-2xl p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/60">Backup</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleExport()} className="hud-btn px-4 py-2 text-sm text-white">
            Export Backup
          </button>
          <label className="hud-btn cursor-pointer px-4 py-2 text-sm text-white">
            Import Backup
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {message ? <p className="mt-4 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}
      </div>

      <div className="hud-panel mt-4 max-w-2xl p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/60">Onboarding</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetBootScreen}
            className="hud-btn px-4 py-2 text-sm text-white"
          >
            Reset Boot Screen
          </button>
        </div>
      </div>

      <div className="hud-panel mt-4 max-w-4xl p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/60">Timeframe Management</p>
        <p className="mt-2 text-sm text-white/75">
          Timeframe length: 30 / 60 / 90 / 180 / 365 days. You can change this after archiving.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {cycleRows.map((row) => (
            <article key={row.engineId} className="chrome-outline rounded-xl bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-white/60">{row.engineName}</p>
              <p className="mt-2 text-sm text-white">{row.cycleTitle}</p>
              <p className="mt-1 text-xs text-white/60">
                {row.cycleLength > 0 ? `Timeframe length: ${row.cycleLength} days` : "No timeframe to manage"}
              </p>
              {row.cycleId ? (
                <p className="mt-1 text-xs text-white/55">
                  Start: {row.cycleStartDate ?? "—"} • Day {row.dayIndex}/{row.cycleLength}
                </p>
              ) : null}
              {row.cycleId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExtendCycle(row.cycleId as number, 30)}
                    disabled={cycleBusy === row.cycleId}
                    className="chrome-btn px-3 py-1.5 text-xs text-white"
                  >
                    +30
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExtendCycle(row.cycleId as number, 60)}
                    disabled={cycleBusy === row.cycleId}
                    className="chrome-btn px-3 py-1.5 text-xs text-white"
                  >
                    +60
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExtendCycle(row.cycleId as number, 90)}
                    disabled={cycleBusy === row.cycleId}
                    className="chrome-btn px-3 py-1.5 text-xs text-white"
                  >
                    +90
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleArchiveCycle(row.cycleId as number)}
                    disabled={cycleBusy === row.cycleId}
                    className="chrome-btn px-3 py-1.5 text-xs text-white"
                  >
                    Archive
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-white/65">Timeframe length</label>
                  <select
                    value={newCycleLengthByEngine[row.engineId] ?? 90}
                    onChange={(event) =>
                      setNewCycleLengthByEngine((prev) => ({
                        ...prev,
                        [row.engineId]: Number(event.target.value),
                      }))
                    }
                    className="rounded-md border border-white/15 bg-black/25 px-2 py-1 text-xs text-white"
                  >
                    {[30, 60, 90, 180, 365].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCreateCycle(row.engineId, row.engineName)}
                    disabled={cycleBusy === row.engineId}
                    className="chrome-btn px-3 py-1.5 text-xs text-white"
                  >
                    Start New Timeframe
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
