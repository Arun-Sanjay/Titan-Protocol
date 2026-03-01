"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getEngineByName } from "../../../../../lib/api";
import {
  createTemplate,
  ensureExerciseCatalogSync,
  listExercises,
  listTemplates,
  startEmptyWorkout,
  startWorkoutFromTemplate,
  getWorkouts,
} from "../../../../../lib/body";

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function GymHomePage() {
  const router = useRouter();
  const [active, setActive] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<Awaited<ReturnType<typeof listTemplates>>>([]);
  const [workouts, setWorkouts] = React.useState<Awaited<ReturnType<typeof getWorkouts>>>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState<boolean>(false);
  const [templateTitle, setTemplateTitle] = React.useState<string>("");
  const [exerciseOptions, setExerciseOptions] = React.useState<Awaited<ReturnType<typeof listExercises>>>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = React.useState<number[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureExerciseCatalogSync();
      const engine = await getEngineByName("body");
      if (!engine?.id || !engine.is_active) {
        setActive(false);
        setTemplates([]);
        setWorkouts([]);
        setExerciseOptions([]);
        return;
      }

      const [nextTemplates, nextWorkouts, nextExercises] = await Promise.all([
        listTemplates(),
        getWorkouts(12),
        listExercises(),
      ]);
      setActive(true);
      setTemplates(nextTemplates);
      setWorkouts(nextWorkouts);
      setExerciseOptions(nextExercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleStartEmptyWorkout() {
    setBusy(true);
    setError(null);
    try {
      const workout = await startEmptyWorkout("Workout", todayDateString());
      router.push(`/os/body/gym/workout/${workout.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartFromTemplate(templateId: number) {
    setBusy(true);
    setError(null);
    try {
      const workout = await startWorkoutFromTemplate(templateId, todayDateString());
      router.push(`/os/body/gym/workout/${workout.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTemplate() {
    if (!templateTitle.trim() || selectedExerciseIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createTemplate(templateTitle, selectedExerciseIds);
      setTemplateTitle("");
      setSelectedExerciseIds([]);
      setIsTemplateModalOpen(false);
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
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Body Gym</h1>
          <p className="mt-2 text-sm text-white/70">Strong-like home for workouts, templates, and recent sessions.</p>
        </div>
        <Link href="/os/body" className="hud-btn px-3 py-1.5 text-sm text-white">
          Back to Body
        </Link>
      </header>

      {loading ? <p className="text-white/75">Loading gym home...</p> : null}
      {!loading && error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
      ) : null}

      {!loading && !error && !active ? (
        <div className="hud-panel p-5">
          <p className="text-white/80">Body engine is inactive.</p>
          <Link href="/os/body" className="hud-btn mt-4 inline-flex px-3 py-1.5 text-sm text-white">
            Open Body Engine
          </Link>
        </div>
      ) : null}

      {!loading && !error && active ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4">
            <div className="hud-panel p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Start</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleStartEmptyWorkout()}
                className="hud-btn mt-4 w-full px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Workout
              </button>
            </div>

            <div className="hud-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Templates</p>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="hud-btn px-3 py-1.5 text-xs text-white"
                >
                  Create Template
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {templates.length === 0 ? (
                  <p className="text-sm text-white/60">No templates saved yet.</p>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="hud-badge flex items-center justify-between rounded-lg px-3 py-3">
                      <div>
                        <p className="text-sm text-white">{template.title}</p>
                        <p className="text-xs text-white/55">
                          {new Date(template.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleStartFromTemplate(template.id as number)}
                        className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Start
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="hud-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Recent Workouts</p>
            <div className="mt-4 space-y-3">
              {workouts.length === 0 ? (
                <p className="text-sm text-white/60">No workouts logged yet.</p>
              ) : (
                workouts.map((workout) => (
                  <div key={workout.id} className="hud-badge flex items-center justify-between rounded-lg px-3 py-3">
                    <div>
                      <p className="text-sm text-white">{workout.title}</p>
                      <p className="text-xs text-white/60">
                        {workout.date} • {workout.finished_at ? "Finished" : "In Progress"}
                      </p>
                    </div>
                    <Link href={`/os/body/gym/workout/${workout.id}`} className="hud-btn px-3 py-1.5 text-xs text-white">
                      Open
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isTemplateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="hud-panel w-full max-w-xl p-5">
            <h2 className="hud-title text-lg">Create Template</h2>
            <input
              value={templateTitle}
              onChange={(event) => setTemplateTitle(event.target.value)}
              className="hud-btn mt-4 w-full px-3 py-2 text-sm text-white outline-none"
              placeholder="Template title"
            />
            <div className="mt-4 max-h-64 space-y-2 overflow-auto">
              {exerciseOptions.map((exercise) => {
                const selected = selectedExerciseIds.includes(exercise.id as number);
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() =>
                      setSelectedExerciseIds((current) =>
                        selected
                          ? current.filter((id) => id !== exercise.id)
                          : [...current, exercise.id as number],
                      )
                    }
                    className={[
                      "hud-badge flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      selected ? "border-white/45 bg-white/10 text-white" : "text-white/80",
                    ].join(" ")}
                  >
                    <span>{exercise.name}</span>
                    <span className="text-xs text-white/55">{selected ? "Selected" : "Add"}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="hud-btn px-3 py-1.5 text-sm text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !templateTitle.trim() || selectedExerciseIds.length === 0}
                onClick={() => void handleCreateTemplate()}
                className="hud-btn px-4 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
