"use client";

import * as React from "react";
import Link from "next/link";

import type { NutritionMeal, NutritionProfile } from "../../../../../lib/db";
import {
  addMeal,
  computeNutritionTargets,
  deleteMeal,
  getNutritionProfile,
  listMealsByDate,
  upsertNutritionProfile,
  type NutritionWizardInput,
} from "../../../../../lib/nutrition";

type WizardState = NutritionWizardInput;

const DEFAULT_WIZARD: WizardState = {
  sex: "male",
  age: 28,
  height_cm: 175,
  weight_kg: 75,
  bodyfat_pct: null,
  steps_per_day: 7000,
  workouts_per_week: 3,
  goal: "maintain",
  rate_kg_per_week: 0,
  protein_preference: "high",
};

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function BodyNutritionPage() {
  const [profile, setProfile] = React.useState<NutritionProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [wizard, setWizard] = React.useState<WizardState>(DEFAULT_WIZARD);
  const [selectedDateISO, setSelectedDateISO] = React.useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [meals, setMeals] = React.useState<NutritionMeal[]>([]);
  const [isAddingMeal, setIsAddingMeal] = React.useState(false);
  const [mealError, setMealError] = React.useState<string | null>(null);
  const [savingMeal, setSavingMeal] = React.useState(false);
  const [mealDraft, setMealDraft] = React.useState({
    name: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
  });

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const existing = await getNutritionProfile();
      if (!mounted) return;
      if (existing) {
        setProfile(existing);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const targets = React.useMemo(() => computeNutritionTargets(wizard), [wizard]);

  React.useEffect(() => {
    if (!profile) return;
    let mounted = true;
    async function loadMeals() {
      const list = await listMealsByDate(selectedDateISO);
      if (mounted) setMeals(list);
    }
    loadMeals();
    return () => {
      mounted = false;
    };
  }, [profile, selectedDateISO]);

  async function handleSave() {
    const nextProfile = await upsertNutritionProfile({
      ...wizard,
      activity_multiplier: targets.activity_multiplier,
      calorie_target: targets.calorie_target,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
    });
    setProfile(nextProfile);
  }

  async function handleAddMeal() {
    const name = mealDraft.name.trim();
    if (!name) {
      setMealError("Meal name is required.");
      return;
    }
    const calories = Number(mealDraft.calories);
    const protein = Number(mealDraft.protein_g);
    if (!Number.isFinite(calories) || calories <= 0) {
      setMealError("Calories must be a valid number.");
      return;
    }
    if (!Number.isFinite(protein) || protein <= 0) {
      setMealError("Protein must be a valid number.");
      return;
    }

    const carbs = mealDraft.carbs_g === "" ? null : Number(mealDraft.carbs_g);
    const fat = mealDraft.fat_g === "" ? null : Number(mealDraft.fat_g);

    setSavingMeal(true);
    setMealError(null);
    try {
      await addMeal({
        dateISO: selectedDateISO,
        name,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      });
      const list = await listMealsByDate(selectedDateISO);
      setMeals(list);
      setMealDraft({ name: "", calories: "", protein_g: "", carbs_g: "", fat_g: "" });
      setIsAddingMeal(false);
    } catch (err) {
      console.error(err);
      setMealError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeal(false);
    }
  }

  const totals = React.useMemo(() => {
    let caloriesTotal = 0;
    let proteinTotal = 0;
    let carbsTotal = 0;
    let fatTotal = 0;
    let carbsHasValue = false;
    let fatHasValue = false;

    for (const meal of meals) {
      caloriesTotal += meal.calories;
      proteinTotal += meal.protein_g;
      if (meal.carbs_g !== null && meal.carbs_g !== undefined) {
        carbsTotal += meal.carbs_g;
        carbsHasValue = true;
      }
      if (meal.fat_g !== null && meal.fat_g !== undefined) {
        fatTotal += meal.fat_g;
        fatHasValue = true;
      }
    }

    return {
      caloriesTotal,
      proteinTotal,
      carbsTotal,
      fatTotal,
      carbsHasValue,
      fatHasValue,
    };
  }, [meals]);

  const showWizard = !loading && !profile;

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="tp-title text-3xl font-bold md:text-4xl">BODY ENGINE</h1>
          <p className="tp-subtitle mt-3 text-sm text-white/70">Nutrition</p>
        </div>
        <div className="tp-tabs">
          <Link href="/os/body" className="tp-tab">
            Body Engine
          </Link>
          <Link href="/os/body/nutrition" className="tp-tab is-active">
            Nutrition
          </Link>
        </div>
      </div>

      {loading ? (
        <section className="tp-panel p-5 sm:p-6">
          <p className="tp-kicker">Nutrition</p>
          <p className="mt-3 text-sm text-white/60">Loading profile…</p>
        </section>
      ) : showWizard ? (
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Nutrition Setup</p>
            <p className="tp-muted">Required</p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="body-label">Sex</label>
              <select
                className="body-select"
                value={wizard.sex}
                onChange={(event) => setWizard((prev) => ({ ...prev, sex: event.target.value as "male" | "female" }))}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="body-label">Age</label>
              <input
                className="body-input"
                type="number"
                min={10}
                value={wizard.age}
                onChange={(event) => setWizard((prev) => ({ ...prev, age: toNumber(event.target.value, prev.age) }))}
              />
            </div>
            <div>
              <label className="body-label">Height (cm)</label>
              <input
                className="body-input"
                type="number"
                min={100}
                value={wizard.height_cm}
                onChange={(event) =>
                  setWizard((prev) => ({ ...prev, height_cm: toNumber(event.target.value, prev.height_cm) }))
                }
              />
            </div>
            <div>
              <label className="body-label">Weight (kg)</label>
              <input
                className="body-input"
                type="number"
                min={30}
                value={wizard.weight_kg}
                onChange={(event) =>
                  setWizard((prev) => ({ ...prev, weight_kg: toNumber(event.target.value, prev.weight_kg) }))
                }
              />
            </div>
            <div>
              <label className="body-label">Body Fat % (optional)</label>
              <input
                className="body-input"
                type="number"
                min={0}
                value={wizard.bodyfat_pct ?? ""}
                onChange={(event) =>
                  setWizard((prev) => ({
                    ...prev,
                    bodyfat_pct: event.target.value === "" ? null : toNumber(event.target.value, 0),
                  }))
                }
              />
            </div>
            <div>
              <label className="body-label">Average steps/day</label>
              <input
                className="body-input"
                type="number"
                min={0}
                value={wizard.steps_per_day}
                onChange={(event) =>
                  setWizard((prev) => ({ ...prev, steps_per_day: toNumber(event.target.value, prev.steps_per_day) }))
                }
              />
            </div>
            <div>
              <label className="body-label">Workouts/week</label>
              <input
                className="body-input"
                type="number"
                min={0}
                value={wizard.workouts_per_week}
                onChange={(event) =>
                  setWizard((prev) => ({
                    ...prev,
                    workouts_per_week: toNumber(event.target.value, prev.workouts_per_week),
                  }))
                }
              />
            </div>
            <div>
              <label className="body-label">Goal</label>
              <select
                className="body-select"
                value={wizard.goal}
                onChange={(event) => {
                  const goal = event.target.value as WizardState["goal"];
                  setWizard((prev) => ({
                    ...prev,
                    goal,
                    rate_kg_per_week: goal === "maintain" ? 0 : prev.rate_kg_per_week || 0.25,
                  }));
                }}
              >
                <option value="cut">Cut</option>
                <option value="bulk">Bulk</option>
                <option value="maintain">Maintain</option>
              </select>
            </div>
            <div>
              <label className="body-label">Rate (kg per week)</label>
              <select
                className="body-select"
                value={wizard.rate_kg_per_week}
                disabled={wizard.goal === "maintain"}
                onChange={(event) =>
                  setWizard((prev) => ({
                    ...prev,
                    rate_kg_per_week: Number(event.target.value) as WizardState["rate_kg_per_week"],
                  }))
                }
              >
                <option value={0.25}>0.25</option>
                <option value={0.5}>0.5</option>
                <option value={0.75}>0.75</option>
                <option value={1}>1.0</option>
              </select>
            </div>
            <div>
              <label className="body-label">Protein preference</label>
              <select
                className="body-select"
                value={wizard.protein_preference}
                onChange={(event) =>
                  setWizard((prev) => ({
                    ...prev,
                    protein_preference: event.target.value as WizardState["protein_preference"],
                  }))
                }
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="tp-panel p-4">
              <p className="tp-kicker">Computed Targets</p>
              <div className="mt-3 text-sm text-white/75 space-y-2">
                <p>Calories/day: {targets.calorie_target}</p>
                <p>Protein: {targets.protein_g} g</p>
                <p>Carbs: {targets.carbs_g} g</p>
                <p>Fat: {targets.fat_g} g</p>
              </div>
            </div>
            <div className="tp-panel p-4">
              <p className="tp-kicker">Activity</p>
              <div className="mt-3 text-sm text-white/75 space-y-2">
                <p>BMR: {Math.round(targets.bmr)}</p>
                <p>Activity multiplier: {targets.activity_multiplier}</p>
                <p>TDEE: {Math.round(targets.tdee)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" className="tp-button w-auto px-5" onClick={handleSave}>
              Save Profile
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <section className="tp-panel p-5 sm:p-6">
              <div className="tp-panel-head">
                <p className="tp-kicker">Targets</p>
                <p className="tp-muted">Per day</p>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-white/78">
                <div className="nutrition-row">
                  <span>Calories</span>
                  <strong>{profile?.calorie_target}</strong>
                </div>
                <div className="nutrition-row">
                  <span>Protein</span>
                  <strong>{profile?.protein_g} g</strong>
                </div>
                <div className="nutrition-row">
                  <span>Carbs</span>
                  <strong>{profile?.carbs_g ?? "—"} g</strong>
                </div>
                <div className="nutrition-row">
                  <span>Fat</span>
                  <strong>{profile?.fat_g ?? "—"} g</strong>
                </div>
              </div>
            </section>

            <section className="tp-panel p-5 sm:p-6">
              <div className="tp-panel-head">
                <p className="tp-kicker">Totals</p>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span>Date</span>
                  <input
                    type="date"
                    value={selectedDateISO}
                    onChange={(event) => setSelectedDateISO(event.target.value)}
                    className="body-select h-8 px-2"
                  />
                </div>
              </div>

              <div className="nutrition-core">
                <div className="nutrition-ring">
                  <div className="nutrition-ring-inner">
                    <div className="nutrition-total">{totals.caloriesTotal}</div>
                    <div className="nutrition-label">Calories</div>
                  </div>
                </div>
                <div className="nutrition-macros">
                  <div>
                    <span>Protein</span>
                    <strong>{totals.proteinTotal} g</strong>
                  </div>
                  <div>
                    <span>Carbs</span>
                    <strong>{totals.carbsHasValue ? `${totals.carbsTotal} g` : "—"}</strong>
                  </div>
                  <div>
                    <span>Fat</span>
                    <strong>{totals.fatHasValue ? `${totals.fatTotal} g` : "—"}</strong>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="nutrition-progress-row">
                      <span>Calories</span>
                      <span>
                        {totals.caloriesTotal}/{profile?.calorie_target}
                      </span>
                    </div>
                    <div className="tp-progress">
                      <span
                        style={{
                          width: profile?.calorie_target
                            ? `${Math.min(100, (totals.caloriesTotal / profile.calorie_target) * 100)}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="nutrition-progress-row">
                      <span>Protein</span>
                      <span>
                        {totals.proteinTotal}/{profile?.protein_g}
                      </span>
                    </div>
                    <div className="tp-progress">
                      <span
                        style={{
                          width: profile?.protein_g
                            ? `${Math.min(100, (totals.proteinTotal / profile.protein_g) * 100)}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="tp-panel mt-6 p-5 sm:p-6">
            <div className="tp-panel-head">
              <p className="tp-kicker">Meals</p>
              <button
                type="button"
                className="tp-button tp-button-inline"
                onClick={() => setIsAddingMeal(true)}
              >
                Add Meal
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/55">
              <span>Meals today: {meals.length}</span>
              <span>{selectedDateISO}</span>
            </div>

            {mealError ? (
              <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {mealError}
              </div>
            ) : null}

            {meals.length === 0 ? (
              <div className="body-empty mt-4">
                No meals logged for this date.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {meals.map((meal) => (
                  <div key={meal.id} className="body-task-row">
                    <div>
                      <div className="text-sm text-white/85">{meal.name}</div>
                      <div className="text-xs text-white/55">
                        {meal.calories} kcal • P {meal.protein_g}g
                        {meal.carbs_g !== null ? ` • C ${meal.carbs_g}g` : ""}
                        {meal.fat_g !== null ? ` • F ${meal.fat_g}g` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="tp-button tp-button-inline"
                      onClick={async () => {
                        await deleteMeal(meal.id);
                        const list = await listMealsByDate(selectedDateISO);
                        setMeals(list);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isAddingMeal ? (
            <div className="body-modal">
              <div className="body-modal-panel">
                <div className="tp-panel-head">
                  <p className="tp-kicker">New Meal</p>
                  <button
                    type="button"
                    onClick={() => setIsAddingMeal(false)}
                    className="tp-button tp-button-inline"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="body-label">Name</label>
                    <input
                      className="body-input"
                      value={mealDraft.name}
                      onChange={(event) => setMealDraft((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="body-label">Calories</label>
                    <input
                      className="body-input"
                      type="number"
                      value={mealDraft.calories}
                      onChange={(event) => setMealDraft((prev) => ({ ...prev, calories: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="body-label">Protein (g)</label>
                    <input
                      className="body-input"
                      type="number"
                      value={mealDraft.protein_g}
                      onChange={(event) => setMealDraft((prev) => ({ ...prev, protein_g: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="body-label">Carbs (g)</label>
                    <input
                      className="body-input"
                      type="number"
                      value={mealDraft.carbs_g}
                      onChange={(event) => setMealDraft((prev) => ({ ...prev, carbs_g: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="body-label">Fat (g)</label>
                    <input
                      className="body-input"
                      type="number"
                      value={mealDraft.fat_g}
                      onChange={(event) => setMealDraft((prev) => ({ ...prev, fat_g: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" className="tp-button w-auto px-4" onClick={handleAddMeal}>
                    {savingMeal ? "Saving..." : "Save Meal"}
                  </button>
                  <button type="button" className="tp-button w-auto px-4" onClick={() => setIsAddingMeal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
