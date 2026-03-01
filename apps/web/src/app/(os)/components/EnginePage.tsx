"use client";

import * as React from "react";
import Link from "next/link";

import type { EngineName, ModuleRecord } from "../../../lib/db";
import {
  activateEngine,
  archiveCycle,
  calculateCycleConsistency,
  calculateEngineScore,
  canCreateCycle,
  createCycle,
  createGymCycle,
  extendCycle,
  fetchDailyLogs,
  getActiveCycles,
  getEngineByName,
  getModuleByName,
  getPrimaryCycle,
  getTodaysFocusUnits,
  getTodaysSkillMinutes,
  getWeeklyWorkoutStats,
  logDaily,
  setModuleActive,
  setPrimaryCycle,
  syncEngineModules,
} from "../../../lib/api";

type EnginePageProps = {
  engine: EngineName;
};

type ActiveCycleView = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  is_primary: boolean;
  consistency: number;
  dayIndex: number;
  totalDays: number;
};

type TodayModuleView = {
  id: number;
  name: string;
  checked: boolean;
};

type ModuleView = {
  id: number;
  name: string;
  is_core: boolean;
  is_active: boolean;
};

type ActiveCycleConflict = {
  id: number;
  title: string;
};

const TOOL_PATHS: Partial<Record<EngineName, string>> = {
  body: "/os/body/gym",
  mind: "/os/mind/focus",
  money: "/os/money/skill",
};

const TOOL_LABELS: Partial<Record<EngineName, string>> = {
  body: "Gym Tool",
  mind: "Focus Timer",
  money: "Skill Tool",
};

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTodayModules(modules: ModuleRecord[], logs: Awaited<ReturnType<typeof fetchDailyLogs>>) {
  const today = todayDateString();
  const logMap = new Map<number, boolean>();
  for (const log of logs) {
    if (log.date === today) {
      logMap.set(log.module_id, log.completed);
    }
  }

  return modules
    .filter((moduleItem) => moduleItem.is_core && moduleItem.is_active && moduleItem.id)
    .map((moduleItem) => ({
      id: moduleItem.id as number,
      name: moduleItem.name,
      checked: logMap.get(moduleItem.id as number) ?? false,
    }));
}

export function EnginePage({ engine }: EnginePageProps) {
  const [engineId, setEngineId] = React.useState<number | null>(null);
  const [engineName, setEngineName] = React.useState<string>(engine);
  const [engineActive, setEngineActive] = React.useState<boolean>(false);
  const [engineScore, setEngineScore] = React.useState<number>(0);
  const [canAddCycle, setCanAddCycle] = React.useState<boolean>(true);
  const [maxActiveCycles, setMaxActiveCycles] = React.useState<number>(3);
  const [newCycleDuration, setNewCycleDuration] = React.useState<number>(90);
  const [cycles, setCycles] = React.useState<ActiveCycleView[]>([]);
  const [todayModules, setTodayModules] = React.useState<TodayModuleView[]>([]);
  const [modules, setModules] = React.useState<ModuleView[]>([]);
  const [selectedDuration, setSelectedDuration] = React.useState<number>(90);
  const [isBusy, setIsBusy] = React.useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [primaryCycle, setPrimaryCycleState] = React.useState<ActiveCycleView | null>(null);
  const [todayFocusUnits, setTodayFocusUnits] = React.useState<number>(0);
  const [weeklyWorkoutCount, setWeeklyWorkoutCount] = React.useState<number>(0);
  const [weeklyWorkoutSets, setWeeklyWorkoutSets] = React.useState<number>(0);
  const [weeklyWorkoutVolume, setWeeklyWorkoutVolume] = React.useState<number>(0);
  const [todaySkillMinutes, setTodaySkillMinutes] = React.useState<number>(0);
  const [activeCycleConflict, setActiveCycleConflict] = React.useState<ActiveCycleConflict | null>(null);

  function parseCycleConflict(err: unknown): ActiveCycleConflict | null {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith("ACTIVE_CYCLE_EXISTS:")) return null;
    const parts = message.split(":");
    const id = Number(parts[1]);
    const title = parts.slice(2).join(":") || `Cycle ${parts[1] ?? ""}`;
    if (!Number.isFinite(id)) return null;
    return { id, title };
  }

  const loadEngine = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setActiveCycleConflict(null);

    try {
      const found = await getEngineByName(engine);
      if (!found?.id || !found.is_active) {
        setEngineId(found?.id ?? null);
        setEngineName(found?.name ?? engine);
        setEngineActive(false);
        setEngineScore(0);
        setCanAddCycle(true);
        setMaxActiveCycles(3);
        setCycles([]);
        setPrimaryCycleState(null);
        setTodayModules([]);
        setModules([]);
        setTodayFocusUnits(0);
        setWeeklyWorkoutCount(0);
        setWeeklyWorkoutSets(0);
        setWeeklyWorkoutVolume(0);
        setTodaySkillMinutes(0);
        return;
      }

      setEngineId(found.id);
      setEngineName(found.name);
      setEngineActive(true);

      const syncedModules = await syncEngineModules(found.id, found.name);
      const gymModule =
        found.name === "body" ? await getModuleByName(found.id, "Gym Tracker") : undefined;
      const cycleScopeModuleId =
        found.name === "body" ? (gymModule?.id ?? null) : null;
      const [cycleRows, engineScoreResult, createGuard, primary, focusUnits, weeklyWorkoutStats, skillMinutes] =
        await Promise.all([
          getActiveCycles(found.id, cycleScopeModuleId),
          calculateEngineScore(found.id),
          canCreateCycle(found.id, cycleScopeModuleId),
          getPrimaryCycle(found.id, cycleScopeModuleId),
          found.name === "mind" ? getTodaysFocusUnits(found.id) : Promise.resolve(0),
          found.name === "body"
            ? getWeeklyWorkoutStats(found.id)
            : Promise.resolve({ workoutsCount: 0, totalSets: 0, totalVolume: 0 }),
          found.name === "money" ? getTodaysSkillMinutes(found.id) : Promise.resolve(0),
        ]);

      const cycleViews = await Promise.all(
        cycleRows.map(async (cycle) => {
          const details = await calculateCycleConsistency(cycle.id as number);
          const aggregate = engineScoreResult.cycles.find((item) => item.cycle_id === cycle.id);
          return {
            id: cycle.id as number,
            title: cycle.title,
            start_date: cycle.start_date,
            end_date: cycle.end_date,
            is_primary: cycle.is_primary,
            consistency: aggregate?.consistency ?? details.consistency,
            dayIndex: details.dayIndex,
            totalDays: details.totalDays,
          };
        }),
      );

      cycleViews.sort((first, second) => {
        if (first.is_primary === second.is_primary) return second.id - first.id;
        return first.is_primary ? -1 : 1;
      });

      setEngineScore(engineScoreResult.engineScore);
      setCanAddCycle(createGuard.ok);
      setMaxActiveCycles(createGuard.max);
      setCycles(cycleViews);
      setPrimaryCycleState(cycleViews.find((cycle) => cycle.is_primary) ?? cycleViews[0] ?? null);
      setModules(
        syncedModules
          .filter((moduleItem) => moduleItem.id)
          .map((moduleItem) => ({
            id: moduleItem.id as number,
            name: moduleItem.name,
            is_core: moduleItem.is_core,
            is_active: moduleItem.is_active,
          }))
          .sort((first, second) => {
            if (first.is_core === second.is_core) return first.name.localeCompare(second.name);
            return first.is_core ? -1 : 1;
          }),
      );
      setTodayFocusUnits(focusUnits);
      setWeeklyWorkoutCount(weeklyWorkoutStats.workoutsCount);
      setWeeklyWorkoutSets(weeklyWorkoutStats.totalSets);
      setWeeklyWorkoutVolume(weeklyWorkoutStats.totalVolume);
      setTodaySkillMinutes(skillMinutes);

      const selectedPrimaryId = primary?.id ?? cycleViews.find((cycle) => cycle.is_primary)?.id;
      if (selectedPrimaryId) {
        const logs = await fetchDailyLogs(selectedPrimaryId);
        setTodayModules(buildTodayModules(syncedModules, logs));
      } else {
        setTodayModules([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [engine]);

  React.useEffect(() => {
    void loadEngine();
  }, [loadEngine]);

  async function handleActivate() {
    setIsBusy(true);
    setIsTransitioning(true);
    setError(null);
    try {
      const activated = await activateEngine(engine);
      if (engine === "body") {
        await createGymCycle(activated.id as number, `${activated.name} Cycle`, selectedDuration);
      } else {
        await createCycle(activated.id as number, `${activated.name} Cycle`, selectedDuration, true);
      }
      await loadEngine();
    } catch (err) {
      const conflict = parseCycleConflict(err);
      if (conflict) {
        setActiveCycleConflict(conflict);
        setError(`Active cycle already exists: ${conflict.title} (#${conflict.id}). Archive it first.`);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsBusy(false);
      setIsTransitioning(false);
    }
  }

  async function handleCreateCycle() {
    if (!engineId) return;
    setIsBusy(true);
    setError(null);
    setActiveCycleConflict(null);
    try {
      if (engine === "body") {
        await createGymCycle(engineId, `${engineName} Cycle`, newCycleDuration);
      } else {
        await createCycle(engineId, `${engineName} Cycle`, newCycleDuration, false);
      }
      await loadEngine();
    } catch (err) {
      const conflict = parseCycleConflict(err);
      if (conflict) {
        setActiveCycleConflict(conflict);
        setError(`Active cycle already exists: ${conflict.title} (#${conflict.id}). Archive it first.`);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSetPrimary(cycleId: number) {
    if (!engineId) return;
    setIsBusy(true);
    setError(null);
    try {
      await setPrimaryCycle(engineId, cycleId);
      await loadEngine();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleExtend(cycleId: number, extension: 30 | 60 | 90) {
    setIsBusy(true);
    setError(null);
    try {
      await extendCycle(cycleId, extension);
      await loadEngine();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleArchive(cycleId: number) {
    setIsBusy(true);
    setError(null);
    try {
      await archiveCycle(cycleId);
      await loadEngine();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleToday(moduleId: number, nextChecked: boolean) {
    if (!primaryCycle?.id) return;
    setIsBusy(true);
    setError(null);
    try {
      await logDaily(primaryCycle.id, moduleId, todayDateString(), nextChecked, nextChecked ? 1 : 0);
      await loadEngine();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleOptionalModule(moduleId: number, nextChecked: boolean) {
    setIsBusy(true);
    setError(null);
    try {
      await setModuleActive(moduleId, nextChecked);
      await loadEngine();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  const toolPath = TOOL_PATHS[engine];
  const toolLabel = TOOL_LABELS[engine];
  const showBodySetupCta = engine === "body" && cycles.length === 0;

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      {isTransitioning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <p className="text-center text-xl font-semibold tracking-wide text-white">
            Initializing {engineName.toUpperCase()} Engine...
          </p>
        </div>
      ) : null}

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">{engineName.toUpperCase()} Engine</h1>
          {engineActive ? (
            <div className="mt-2 space-y-1 text-sm text-white/80">
              <p>
                Engine consistency: <span className="text-white">{engineScore.toFixed(1)}%</span>
              </p>
              <p>
                Primary cycle:{" "}
                {primaryCycle ? (
                  <span className="text-white">
                    {primaryCycle.title} • Day {primaryCycle.dayIndex}/{primaryCycle.totalDays} •{" "}
                    {primaryCycle.consistency.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-white/60">No primary cycle</span>
                )}
              </p>
              {engine === "body" ? (
                <p>
                  Weekly gym stats:{" "}
                  <span className="text-white">
                    {weeklyWorkoutCount} workouts • {weeklyWorkoutSets} sets • {weeklyWorkoutVolume.toFixed(0)} volume
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {showBodySetupCta ? (
            <Link href="/os/settings" className="hud-btn px-3 py-1.5 text-sm text-white">
              Set up your Plan
            </Link>
          ) : null}
          {engineActive ? (
            <button
              type="button"
              disabled={!canAddCycle || isBusy}
              onClick={() => void handleCreateCycle()}
              className="hud-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              New Cycle
            </button>
          ) : null}
          <Link href="/os" className="hud-btn px-3 py-1.5 text-sm text-white">
            Back to Dashboard
          </Link>
        </div>
      </section>

      {engineActive ? (
        <section className="mb-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="hud-badge rounded-lg bg-black/25 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/70">New Cycle Duration</span>
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setNewCycleDuration(days)}
                  className={[
                    "hud-btn px-2 py-1 text-xs",
                    newCycleDuration === days ? "text-white" : "text-white/70",
                  ].join(" ")}
                >
                  {days}
                </button>
              ))}
              <span className="text-xs text-white/60">
                {cycles.length}/{maxActiveCycles} active
              </span>
            </div>
          </div>

          {toolPath && toolLabel ? (
            <div className="hud-badge rounded-lg bg-black/25 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-white/60">Tools</p>
              <div className="mt-2 space-y-2 text-sm text-white/80">
                {engine === "mind" ? <p>Today Focus Units: {todayFocusUnits}</p> : null}
                {engine === "body" ? <p>Workouts this week: {weeklyWorkoutCount}</p> : null}
                {engine === "money" ? <p>Today Skill Minutes: {todaySkillMinutes}</p> : null}
              </div>
              <Link href={toolPath} className="hud-btn mt-3 inline-flex px-3 py-1.5 text-sm text-white">
                {toolLabel}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="hud-panel p-5">
        {loading ? <p className="text-white/80">Loading engine...</p> : null}

        {!loading && error ? (
          <div className="space-y-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3">
            <p className="text-sm text-red-100">{error}</p>
            {activeCycleConflict ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleArchive(activeCycleConflict.id)}
                className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Archive Blocking Cycle
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && !engineActive ? (
          <div className="space-y-4">
            <p className="text-white/80">Engine inactive.</p>
            {engine === "body" ? (
              <p className="text-sm text-white/65">No active body plan found. Set up your Plan in Settings.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {[30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setSelectedDuration(days)}
                  className={[
                    "hud-btn px-3 py-1.5 text-sm font-semibold",
                    selectedDuration === days ? "text-white" : "text-white/70",
                  ].join(" ")}
                >
                  {days} Days
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleActivate()}
              className="hud-btn px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? "Starting..." : "Start Engine"}
            </button>
          </div>
        ) : null}

        {!loading && !error && engineActive ? (
          <div className="space-y-5">
            <div id="today" className="space-y-2">
              <p className="text-sm text-white/70">Today</p>
              {primaryCycle ? (
                <div className="hud-badge rounded-lg bg-black/25 p-3">
                  <p className="mb-3 text-xs text-white/60">
                    Core modules for {primaryCycle.title} • {todayDateString()}
                  </p>
                  {todayModules.length === 0 ? (
                    <p className="text-sm text-white/65">No core modules available yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {todayModules.map((moduleItem) => (
                        <label
                          key={moduleItem.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/4 px-3 py-2"
                        >
                          <span className="text-sm text-white">{moduleItem.name}</span>
                          <input
                            type="checkbox"
                            checked={moduleItem.checked}
                            disabled={isBusy}
                            onChange={(event) =>
                              void handleToggleToday(moduleItem.id, event.target.checked)
                            }
                            className="h-4 w-4 accent-white disabled:cursor-not-allowed"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/65">Create a primary cycle to start daily logs.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/70">Modules</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="hud-badge rounded-lg bg-black/25 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-white/60">Core</p>
                  <div className="space-y-2">
                    {modules.filter((moduleItem) => moduleItem.is_core).map((moduleItem) => (
                      <label
                        key={moduleItem.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/4 px-3 py-2"
                      >
                        <span className="text-sm text-white">{moduleItem.name}</span>
                        <input type="checkbox" checked disabled readOnly className="h-4 w-4 accent-white" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="hud-badge rounded-lg bg-black/25 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-white/60">Optional</p>
                  <div className="space-y-2">
                    {modules.filter((moduleItem) => !moduleItem.is_core).length === 0 ? (
                      <p className="text-sm text-white/60">No optional modules available.</p>
                    ) : (
                      modules
                        .filter((moduleItem) => !moduleItem.is_core)
                        .map((moduleItem) => (
                          <label
                            key={moduleItem.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/4 px-3 py-2"
                          >
                            <span className="text-sm text-white">{moduleItem.name}</span>
                            <input
                              type="checkbox"
                              checked={moduleItem.is_active}
                              disabled={isBusy}
                              onChange={(event) =>
                                void handleToggleOptionalModule(moduleItem.id, event.target.checked)
                              }
                              className="h-4 w-4 accent-white disabled:cursor-not-allowed"
                            />
                          </label>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-white/70">Active Cycles</p>
              {cycles.length === 0 ? (
                <p className="text-sm text-white/70">No active cycles yet.</p>
              ) : (
                <ul className="space-y-2">
                  {cycles.map((cycle) => (
                    <li key={cycle.id} className="hud-badge rounded-lg bg-black/25 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm text-white">{cycle.title}</p>
                          <p className="text-xs text-white/65">
                            {cycle.start_date} → {cycle.end_date}
                          </p>
                          <p className="text-xs text-white/70">
                            Day {cycle.dayIndex}/{cycle.totalDays} • Consistency {cycle.consistency.toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy || cycle.is_primary}
                            onClick={() => void handleSetPrimary(cycle.id)}
                            className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {cycle.is_primary ? "Primary" : "Set Primary"}
                          </button>
                          {[30, 60, 90].map((extension) => (
                            <button
                              key={extension}
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleExtend(cycle.id, extension as 30 | 60 | 90)}
                              className="hud-btn px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              +{extension}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleArchive(cycle.id)}
                            className="hud-btn px-2 py-1 text-xs text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
