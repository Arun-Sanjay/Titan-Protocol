"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { listExercises } from "../../../../../../../lib/body";
import { getBestSet, getExerciseHistory } from "../../../../../../../lib/body_stats";

export default function ExerciseHistoryPage() {
  const params = useParams<{ id: string }>();
  const exerciseId = Number.parseInt(params.id ?? "", 10);
  const [exerciseName, setExerciseName] = React.useState<string>("Exercise");
  const [best, setBest] = React.useState<Awaited<ReturnType<typeof getBestSet>>>();
  const [history, setHistory] = React.useState<Awaited<ReturnType<typeof getExerciseHistory>>>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!Number.isFinite(exerciseId)) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [bestSet, historyRows, exercises] = await Promise.all([
          getBestSet(exerciseId),
          getExerciseHistory(exerciseId, 30),
          listExercises(),
        ]);
        setBest(bestSet);
        setHistory(historyRows);
        const exercise = exercises.find((item) => item.id === exerciseId);
        setExerciseName(exercise?.name ?? "Exercise");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [exerciseId]);

  if (!Number.isFinite(exerciseId)) {
    return <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">Invalid exercise id.</main>;
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">{exerciseName}</h1>
          <p className="mt-2 text-sm text-white/70">Strength history and PR overview.</p>
        </div>
        <Link href="/os/body/gym" className="hud-btn px-3 py-1.5 text-sm text-white">
          Back to Gym Home
        </Link>
      </header>

      {loading ? <p className="text-white/75">Loading history...</p> : null}
      {!loading && error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="hud-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Best Set</p>
            {best ? (
              <div className="mt-4 space-y-2">
                <p className="text-2xl font-semibold text-white">
                  {best.weight}kg x {best.reps}
                </p>
                <p className="text-sm text-white/75">Estimated 1RM: {Math.round(best.estimated1RM)}</p>
                <p className="text-xs text-white/60">
                  {best.date} • {best.workout_title}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/60">No completed sets yet.</p>
            )}
          </section>

          <section className="hud-panel p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Recent Sessions</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm text-white/85">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-white/55">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Workout</th>
                    <th className="pb-2">Set</th>
                    <th className="pb-2">Weight</th>
                    <th className="pb-2">Reps</th>
                    <th className="pb-2">1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-3 text-sm text-white/60">
                        No history yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((row) => (
                      <tr key={row.set_id} className="border-t border-white/10">
                        <td className="py-2">{row.date}</td>
                        <td className="py-2">{row.workout_title}</td>
                        <td className="py-2">#{row.set_index}</td>
                        <td className="py-2">{row.weight}kg</td>
                        <td className="py-2">{row.reps}</td>
                        <td className="py-2">{Math.round(row.estimated1RM)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
