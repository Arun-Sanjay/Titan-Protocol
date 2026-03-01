"use client";

import * as React from "react";
import Link from "next/link";

import { getActiveBodyProgram } from "../../../../../lib/body_program";
import { addMeal, computeTotals, deleteMeal, listMealsByDate, updateMeal } from "../../../../../lib/body";
import { getCurrentNutritionTarget } from "../../../../../lib/nutrition";
import type { BodyMealRecord } from "../../../../../lib/db";
import { MealModal } from "../../../../../components/body/MealModal";
import { CalorieCore } from "../../../../../components/body/CalorieCore";

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Totals = {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export default function BodyNutritionPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [selectedDate, setSelectedDate] = React.useState(todayDateString());
  const [programId, setProgramId] = React.useState<number | null>(null);
  const [goalCalories, setGoalCalories] = React.useState<number | null>(null);
  const [meals, setMeals] = React.useState<BodyMealRecord[]>([]);
  const [totals, setTotals] = React.useState<Totals>({
    calories: 0,
    protein: null,
    carbs: null,
    fat: null,
  });

  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingMeal, setEditingMeal] = React.useState<BodyMealRecord | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveBodyProgram();
      const activeProgramId = active?.program.id ?? null;
      setProgramId(activeProgramId);

      const [nextMeals, nextTotals, target] = await Promise.all([
        listMealsByDate(selectedDate),
        computeTotals(selectedDate),
        activeProgramId ? getCurrentNutritionTarget(activeProgramId) : Promise.resolve(null),
      ]);
      setMeals(nextMeals);
      setTotals(nextTotals);
      setGoalCalories(target?.calories ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(payload: {
    name: string;
    calories: number;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  }) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await addMeal({ date: selectedDate, ...payload });
      setAddOpen(false);
      await load();
      setMessage("Meal added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(payload: {
    name: string;
    calories: number;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  }) {
    if (!editingMeal?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateMeal(editingMeal.id, payload);
      setEditOpen(false);
      setEditingMeal(null);
      await load();
      setMessage("Meal updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mealId: number) {
    if (!window.confirm("Delete this meal?")) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteMeal(mealId);
      await load();
      setMessage("Meal deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Body Nutrition</h1>
          <p className="mt-2 text-sm text-white/70">Track meals and daily nutrition totals.</p>
        </div>
        <Link href="/os/body" className="chrome-btn px-3 py-1.5 text-sm text-white">
          Back to Body
        </Link>
      </header>

      {!programId && !loading ? (
        <section className="chrome-panel p-5">
          <p className="text-sm text-white/75">No active Body cycle. Set up your Plan first.</p>
          <p className="mt-2 text-xs text-white/60">You can change this after archiving.</p>
          <Link href="/os/settings" className="chrome-btn mt-3 inline-flex px-3 py-1.5 text-sm text-white">
            Open Settings
          </Link>
        </section>
      ) : null}

      {programId ? (
        <>
          <section className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-xs uppercase tracking-wide text-white/70">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value || todayDateString())}
              className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => setSelectedDate(todayDateString())}
              className="chrome-btn px-3 py-1.5 text-xs text-white"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="chrome-btn ml-auto px-3 py-1.5 text-sm text-white"
              disabled={saving}
            >
              Add Meal
            </button>
          </section>

          {error ? (
            <p className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
          ) : null}
          {message ? (
            <p className="mb-4 rounded-md border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              {message}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <section className="chrome-panel p-5">
              <h2 className="mb-3 text-lg font-semibold text-white">Totals</h2>
              <CalorieCore
                calories={totals.calories}
                goalCalories={goalCalories}
                protein={totals.protein}
                carbs={totals.carbs}
                fat={totals.fat}
              />
            </section>

            <section className="chrome-panel p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Meals</h2>
                <span className="text-xs uppercase tracking-[0.14em] text-white/60">{selectedDate}</span>
              </div>

              {loading ? <p className="text-sm text-white/65">Loading meals...</p> : null}
              {!loading && meals.length === 0 ? (
                <p className="text-sm text-white/65">No meals logged for this date.</p>
              ) : null}

              <div className="space-y-2">
                {meals.map((meal) => (
                  <article
                    key={meal.id}
                    className="chrome-outline flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{meal.name}</p>
                      <p className="text-xs text-white/65">
                        {meal.calories} kcal • P {meal.protein ?? "—"} • C {meal.carbs ?? "—"} • F{" "}
                        {meal.fat ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="chrome-btn px-2 py-1 text-xs text-white"
                        onClick={() => {
                          setEditingMeal(meal);
                          setEditOpen(true);
                        }}
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="chrome-btn px-2 py-1 text-xs text-white"
                        onClick={() => void handleDelete(meal.id as number)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}

      <MealModal
        open={addOpen}
        title="Add Meal"
        saving={saving}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
      <MealModal
        open={editOpen}
        title="Edit Meal"
        saving={saving}
        initial={
          editingMeal
            ? {
                name: editingMeal.name,
                calories: String(editingMeal.calories),
                protein: editingMeal.protein === null ? "" : String(editingMeal.protein),
                carbs: editingMeal.carbs === null ? "" : String(editingMeal.carbs),
                fat: editingMeal.fat === null ? "" : String(editingMeal.fat),
              }
            : undefined
        }
        onClose={() => {
          setEditOpen(false);
          setEditingMeal(null);
        }}
        onSubmit={handleEdit}
      />
    </main>
  );
}
