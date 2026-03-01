"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  addExerciseToWorkout,
  createSetWithDefaults,
  ensureExerciseCatalogSync,
  finishWorkout,
  getWorkoutDetail,
  listExercises,
  updateWorkoutSet,
} from "../../../../../../../lib/body";
import {
  getBestSet,
  getLastWorkoutForExercise,
  type BestSetResult,
  type LastWorkoutExerciseResult,
} from "../../../../../../../lib/body_stats";

type FocusTarget = { setId: number; field: "weight" | "reps" } | null;
type ExerciseInsight = {
  best?: BestSetResult;
  last?: LastWorkoutExerciseResult;
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function WorkoutSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workoutId = Number.parseInt(params.id ?? "", 10);
  const [detail, setDetail] = React.useState<Awaited<ReturnType<typeof getWorkoutDetail>> | null>(null);
  const [exerciseOptions, setExerciseOptions] = React.useState<Awaited<ReturnType<typeof listExercises>>>([]);
  const [search, setSearch] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = React.useState<number>(0);
  const [restSeconds, setRestSeconds] = React.useState<number>(0);
  const [isRestRunning, setIsRestRunning] = React.useState<boolean>(false);
  const [isPickerOpen, setIsPickerOpen] = React.useState<boolean>(false);
  const [pendingFocus, setPendingFocus] = React.useState<FocusTarget>(null);
  const [insightsByExerciseId, setInsightsByExerciseId] = React.useState<Record<number, ExerciseInsight>>(
    {},
  );
  const [prBadges, setPrBadges] = React.useState<Record<number, boolean>>({});
  const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

  const load = React.useCallback(async () => {
    if (!Number.isFinite(workoutId)) return;
    setLoading(true);
    setError(null);
    try {
      await ensureExerciseCatalogSync();
      const [workoutDetail, exercises] = await Promise.all([
        getWorkoutDetail(workoutId),
        listExercises(search),
      ]);
      setDetail(workoutDetail ?? null);
      setExerciseOptions(exercises);

      if (workoutDetail) {
        const uniqueExerciseIds = Array.from(
          new Set(
            workoutDetail.exercises
              .map(({ exercise }) => exercise.exercise_id)
              .filter((exerciseId): exerciseId is number => Number.isFinite(exerciseId)),
          ),
        );

        const insightPairs = await Promise.all(
          uniqueExerciseIds.map(async (exerciseId) => {
            const [best, last] = await Promise.all([
              getBestSet(exerciseId),
              getLastWorkoutForExercise(exerciseId),
            ]);
            return [exerciseId, { best, last } satisfies ExerciseInsight] as const;
          }),
        );

        setInsightsByExerciseId(Object.fromEntries(insightPairs));
      } else {
        setInsightsByExerciseId({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [search, workoutId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!detail?.workout || detail.workout.finished_at) return;
    const storageKey = `titan-workout-start-${detail.workout.id}`;
    const stored = window.localStorage.getItem(storageKey);
    const startAt = stored ? Number.parseInt(stored, 10) : Date.now();
    if (!stored) {
      window.localStorage.setItem(storageKey, String(startAt));
    }
    setElapsedMs(Date.now() - startAt);

    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startAt);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [detail?.workout?.finished_at, detail?.workout?.id]);

  React.useEffect(() => {
    if (!isRestRunning) return;
    const timer = window.setInterval(() => {
      setRestSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setIsRestRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRestRunning]);

  React.useEffect(() => {
    if (!pendingFocus) return;
    const key = `${pendingFocus.setId}-${pendingFocus.field}`;
    const input = inputRefs.current.get(key);
    if (input) {
      input.focus();
      input.select();
      setPendingFocus(null);
    }
  }, [pendingFocus, detail]);

  async function handleAddSet(workoutExerciseId: number) {
    setBusy(true);
    setError(null);
    try {
      const createdSet = await createSetWithDefaults(workoutExerciseId);
      setPendingFocus({ setId: createdSet.id as number, field: "weight" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateSet(
    setId: number,
    changes: Parameters<typeof updateWorkoutSet>[1],
    exerciseId?: number | null,
  ) {
    const previousBest = exerciseId ? insightsByExerciseId[exerciseId]?.best?.estimated1RM ?? 0 : 0;
    setBusy(true);
    setError(null);
    try {
      await updateWorkoutSet(setId, changes);
      if (exerciseId && ("weight" in changes || "reps" in changes)) {
        const nextBest = await getBestSet(exerciseId);
        if ((nextBest?.estimated1RM ?? 0) > previousBest + 0.001) {
          setPrBadges((current) => ({ ...current, [exerciseId]: true }));
          window.setTimeout(() => {
            setPrBadges((current) => ({ ...current, [exerciseId]: false }));
          }, 2400);
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddExercise(exerciseId?: number) {
    if (!detail?.workout.id) return;
    const input = search.trim();
    if (!exerciseId && !input) return;

    setBusy(true);
    setError(null);
    try {
      await addExerciseToWorkout(detail.workout.id, exerciseId ?? input);
      setSearch("");
      setIsPickerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFinishWorkout() {
    if (!detail?.workout.id) return;
    setBusy(true);
    setError(null);
    try {
      await finishWorkout(detail.workout.id);
      window.localStorage.removeItem(`titan-workout-start-${detail.workout.id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleEnter(
    event: React.KeyboardEvent<HTMLInputElement>,
    setId: number,
    field: "weight" | "reps",
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const nextField = field === "weight" ? "reps" : "weight";
    const nextSetId =
      field === "reps"
        ? detail?.exercises
            .flatMap(({ sets }) => sets)
            .find((set) => set.set_index > (detail?.exercises.flatMap(({ sets }) => sets).find((s) => s.id === setId)?.set_index ?? 0))
            ?.id ?? setId
        : setId;
    const nextInput = inputRefs.current.get(`${nextSetId}-${nextField}`);
    nextInput?.focus();
    nextInput?.select();
  }

  if (!Number.isFinite(workoutId)) {
    return <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">Invalid workout id.</main>;
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">{detail?.workout.title ?? "Workout Session"}</h1>
          <p className="mt-2 text-sm text-white/70">
            {detail?.workout.date ?? ""} • Elapsed {formatElapsed(elapsedMs)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/os/body/gym" className="hud-btn px-3 py-1.5 text-sm text-white">
            Gym Home
          </Link>
          <button
            type="button"
            disabled={busy || !detail || !!detail.workout.finished_at}
            onClick={() => void handleFinishWorkout()}
            className="hud-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {detail?.workout.finished_at ? "Finished" : "Finish Workout"}
          </button>
        </div>
      </header>

      {loading ? <p className="text-white/75">Loading workout...</p> : null}
      {!loading && error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
      ) : null}

      {!loading && !error && detail ? (
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="space-y-4">
            {detail.exercises.map(({ exercise, sets }) => (
              <article key={exercise.id} className="hud-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{exercise.name}</h2>
                      {exercise.exercise_id ? (
                        <Link
                          href={`/os/body/gym/exercise/${exercise.exercise_id}`}
                          className="hud-btn px-2 py-0.5 text-[10px] text-white"
                        >
                          History
                        </Link>
                      ) : null}
                      {exercise.exercise_id && prBadges[exercise.exercise_id] ? (
                        <span className="hud-pill px-2 py-0.5 text-[10px] text-emerald-200">PR</span>
                      ) : null}
                    </div>
                    {exercise.exercise_id ? (
                      <p className="mt-1 text-xs text-white/70">
                        Last:{" "}
                        {insightsByExerciseId[exercise.exercise_id]?.last
                          ? `${insightsByExerciseId[exercise.exercise_id]?.last?.weight}kg x ${insightsByExerciseId[exercise.exercise_id]?.last?.reps}`
                          : "—"}{" "}
                        • Best:{" "}
                        {insightsByExerciseId[exercise.exercise_id]?.best
                          ? `${insightsByExerciseId[exercise.exercise_id]?.best?.weight}kg x ${insightsByExerciseId[exercise.exercise_id]?.best?.reps} (1RM ${Math.round(insightsByExerciseId[exercise.exercise_id]?.best?.estimated1RM ?? 0)})`
                          : "—"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy || !!detail.workout.finished_at}
                    onClick={() => void handleAddSet(exercise.id as number)}
                    className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Add Set
                  </button>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm text-white/85">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.14em] text-white/55">
                        <th className="pb-2">Set</th>
                        <th className="pb-2">Weight</th>
                        <th className="pb-2">Reps</th>
                        <th className="pb-2">Done</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sets.map((set) => (
                        <tr key={set.id} className="border-t border-white/10">
                          <td className="py-2 text-xs text-white/70">#{set.set_index}</td>
                          <td className="py-2">
                            <input
                              ref={(node) => {
                                if (node) inputRefs.current.set(`${set.id}-weight`, node);
                              }}
                              type="number"
                              value={set.weight}
                              disabled={busy || !!detail.workout.finished_at}
                              onChange={(event) =>
                                void handleUpdateSet(set.id as number, {
                                  weight: Number.parseFloat(event.target.value || "0"),
                                }, exercise.exercise_id)
                              }
                              onKeyDown={(event) => handleEnter(event, set.id as number, "weight")}
                              className="hud-btn w-24 px-2 py-1 text-sm text-white outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              ref={(node) => {
                                if (node) inputRefs.current.set(`${set.id}-reps`, node);
                              }}
                              type="number"
                              value={set.reps}
                              disabled={busy || !!detail.workout.finished_at}
                              onChange={(event) =>
                                void handleUpdateSet(set.id as number, {
                                  reps: Number.parseInt(event.target.value || "0", 10),
                                }, exercise.exercise_id)
                              }
                              onKeyDown={(event) => handleEnter(event, set.id as number, "reps")}
                              className="hud-btn w-24 px-2 py-1 text-sm text-white outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={!!set.done}
                              disabled={busy || !!detail.workout.finished_at}
                              onChange={(event) =>
                                void handleUpdateSet(set.id as number, { done: event.target.checked }, exercise.exercise_id)
                              }
                              className="h-4 w-4 accent-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}

            <button
              type="button"
              disabled={busy || !!detail.workout.finished_at}
              onClick={() => setIsPickerOpen(true)}
              className="hud-btn w-full px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Exercise
            </button>
          </section>

          <section className="space-y-4">
            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Rest Timer</p>
              <p className="mt-3 text-4xl font-semibold text-white">{formatElapsed(restSeconds * 1000).slice(3)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[60, 90, 120].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => {
                      setRestSeconds(seconds);
                      setIsRestRunning(true);
                    }}
                    className="hud-btn px-3 py-1.5 text-xs text-white"
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRestRunning(false);
                  setRestSeconds(0);
                }}
                className="hud-btn mt-3 px-3 py-1.5 text-xs text-white"
              >
                Reset
              </button>
            </div>

            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Session Status</p>
              <p className="mt-3 text-sm text-white/80">
                {detail.workout.finished_at
                  ? `Finished at ${new Date(detail.workout.finished_at).toLocaleTimeString()}`
                  : "In progress"}
              </p>
              <button
                type="button"
                onClick={() => router.push("/os/body/gym")}
                className="hud-btn mt-4 px-3 py-1.5 text-xs text-white"
              >
                Back to Gym Home
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="hud-panel w-full max-w-xl p-5">
            <h2 className="hud-title text-lg">Exercise Picker</h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="hud-btn mt-4 w-full px-3 py-2 text-sm text-white outline-none"
              placeholder="Search exercises"
            />
            <div className="mt-4 max-h-80 space-y-2 overflow-auto">
              {exerciseOptions.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => void handleAddExercise(exercise.id as number)}
                  className="hud-badge flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white"
                >
                  <span>{exercise.name}</span>
                  <span className="text-xs text-white/55">{exercise.muscle_group ?? "General"}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="hud-btn px-3 py-1.5 text-sm text-white"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!search.trim() || busy}
                onClick={() => void handleAddExercise()}
                className="hud-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add “{search.trim() || "Exercise"}”
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
