"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { upsertBodyProfile } from "../../lib/body_profile";
import { computeDailyCalorieDelta } from "../../lib/body_program";
import {
  createCycle,
  createTask,
  getOrCreateEngine,
  getPrimaryCycle,
  listTasks,
  type Engine,
} from "../../lib/api";
import type { BodyProfileTrack, RateKgPerWeek } from "../../lib/db";

type Goal = "cut" | "maintain" | "bulk";
type Training = "gym" | "boxing" | "both" | "none";
type DietPref = "high_protein" | "balanced" | "vegetarian";
type Activity = "low" | "med" | "high";
type Issue = "overeating" | "consistency" | "sleep" | "motivation";

type FormState = {
  heightCm: string;
  weightKg: string;
  goal: Goal;
  rateKgPerWeek: RateKgPerWeek;
  training: Training;
  trainingDays: string;
  sleepBy: string;
  wakeAt: string;
  dietPreference: DietPref;
  activity: Activity;
  biggestIssue: Issue;
};

const DEFAULT_FORM: FormState = {
  heightCm: "175",
  weightKg: "75",
  goal: "maintain",
  rateKgPerWeek: 0.5,
  training: "gym",
  trainingDays: "4",
  sleepBy: "23:00",
  wakeAt: "07:00",
  dietPreference: "balanced",
  activity: "med",
  biggestIssue: "consistency",
};

function toGoalType(goal: Goal): "fat_loss" | "discipline" | "muscle_gain" {
  if (goal === "cut") return "fat_loss";
  if (goal === "bulk") return "muscle_gain";
  return "discipline";
}

function toTrackSelection(training: Training): BodyProfileTrack[] {
  if (training === "gym") return ["gym_strength"];
  if (training === "boxing") return ["boxing"];
  if (training === "both") return ["gym_strength", "boxing"];
  return ["mobility"];
}

function toActivityLevel(activity: Activity): "sedentary" | "moderate" | "active" {
  if (activity === "low") return "sedentary";
  if (activity === "high") return "active";
  return "moderate";
}

function toStress(issue: Issue): "low" | "medium" | "high" {
  if (issue === "sleep") return "high";
  if (issue === "motivation") return "medium";
  return "medium";
}

function deriveSleepHours(sleepBy: string, wakeAt: string): number {
  const [sh, sm] = sleepBy.split(":").map(Number);
  const [wh, wm] = wakeAt.split(":").map(Number);
  let sleepMinutes = (wh * 60 + wm) - (sh * 60 + sm);
  if (sleepMinutes <= 0) sleepMinutes += 24 * 60;
  return Math.max(4, Math.min(10, Number((sleepMinutes / 60).toFixed(1))));
}

function getStepsTarget(activity: Activity): number {
  if (activity === "low") return 8000;
  if (activity === "high") return 12000;
  return 10000;
}

function buildTasks(form: FormState) {
  const weight = Number(form.weightKg);
  const proteinTarget = Math.max(80, Math.round(weight * 1.6));
  const waterLiters = Math.max(2.2, Math.min(4.0, Number((weight * 0.035).toFixed(1))));
  const trainingTitle =
    form.training === "none"
      ? "Mobility or recovery session"
      : form.training === "both"
        ? `Gym or boxing session (${form.trainingDays}/week)`
        : `${form.training === "gym" ? "Workout" : "Boxing"} session (${form.trainingDays}/week)`;

  const nonNegotiables = [
    `Sleep by ${form.sleepBy}`,
    `Wake at ${form.wakeAt}`,
    `Hit protein target (${proteinTarget}g)` ,
    trainingTitle,
    `Drink ${waterLiters}L water`,
  ];

  const optional = [
    `Steps target (${getStepsTarget(form.activity)}+)`,
    "10-minute mobility",
    "Meal prep for tomorrow",
    ...(form.goal === "cut" ? ["Cardio Zone 2 session"] : []),
  ];

  return { nonNegotiables, optional };
}

async function ensureBodyCycle(engine: Engine, timeframe: number): Promise<void> {
  const current = await getPrimaryCycle(engine.id as number);
  if (current?.id) return;
  await createCycle(engine.id as number, `Body ${timeframe}D Cycle`, timeframe, true);
}

export function BodyIntakeWizard({ initialTimeframe = 90 }: { initialTimeframe?: number }) {
  const router = useRouter();
  const timeframeFromQuery = Number(initialTimeframe);
  const timeframe = [30, 60, 90, 180, 365].includes(timeframeFromQuery) ? timeframeFromQuery : 90;

  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFinish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const bodyEngine = await getOrCreateEngine("body");
      await ensureBodyCycle(bodyEngine, timeframe);

      const goalDirection = form.goal;
      const dailyCalorieDelta = computeDailyCalorieDelta(goalDirection, form.rateKgPerWeek);
      const tracks = toTrackSelection(form.training);
      const trainingDays = Math.max(1, Math.min(7, Number(form.trainingDays || "1")));

      await upsertBodyProfile({
        height_cm: Number(form.heightCm),
        weight_kg: Number(form.weightKg),
        age: 25,
        sex: "other",
        activity_level: toActivityLevel(form.activity),
        goal_type: toGoalType(form.goal),
        goal_direction: form.goal,
        rate_kg_per_week: form.rateKgPerWeek,
        daily_calorie_delta: dailyCalorieDelta,
        goal_weight_kg: null,
        experience: "beginner",
        tracks,
        track_config: Object.fromEntries(
          tracks.map((track) => [track, { days_per_week: trainingDays, session_minutes: 60 }]),
        ),
        diet_type: form.dietPreference === "vegetarian" ? "veg" : "non_veg",
        allergies: [],
        meals_per_day: 3,
        tracking_mode: "calories_only",
        sleep_hours_avg: deriveSleepHours(form.sleepBy, form.wakeAt),
        sleep_window: { bedtime: form.sleepBy, wake: form.wakeAt },
        stress_level: toStress(form.biggestIssue),
        injuries: [],
        discipline_mode: "strict",
      });

      const existing = await listTasks(bodyEngine.id as number, { include_inactive: false });
      const existingTitles = new Set(existing.map((task) => task.title.trim().toLowerCase()));
      const taskSet = buildTasks(form);

      for (const title of taskSet.nonNegotiables) {
        if (existingTitles.has(title.toLowerCase())) continue;
        await createTask({
          engine_id: bodyEngine.id as number,
          title,
          is_non_negotiable: true,
          is_locked: true,
        });
      }

      for (const title of taskSet.optional) {
        if (existingTitles.has(title.toLowerCase())) continue;
        await createTask({
          engine_id: bodyEngine.id as number,
          title,
          is_non_negotiable: false,
          is_locked: false,
        });
      }

      router.push("/os/body");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Body Intake</h1>
          <p className="mt-2 text-sm text-white/70">Answer these to generate your Body tasks and start your cycle.</p>
        </div>
        <Link href="/os/body/settings" className="chrome-btn px-3 py-1.5 text-sm text-white">
          Back
        </Link>
      </header>

      <section className="chrome-panel p-5">
        <p className="mb-4 text-xs uppercase tracking-[0.14em] text-white/60">Timeframe: {timeframe} days</p>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleFinish}>
          <label className="grid gap-1 text-sm text-white/80">
            Height (cm)
            <input value={form.heightCm} onChange={(e) => setField("heightCm", e.target.value)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white" required />
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Weight (kg)
            <input value={form.weightKg} onChange={(e) => setField("weightKg", e.target.value)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white" required />
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Goal
            <select value={form.goal} onChange={(e) => setField("goal", e.target.value as Goal)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white">
              <option value="cut">Cut</option>
              <option value="maintain">Maintain</option>
              <option value="bulk">Bulk</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Target rate (kg/week)
            <select value={form.rateKgPerWeek} onChange={(e) => setField("rateKgPerWeek", Number(e.target.value) as RateKgPerWeek)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white">
              <option value={0.25}>0.25</option>
              <option value={0.5}>0.5</option>
              <option value={0.75}>0.75</option>
              <option value={1.0}>1.0</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Training
            <select value={form.training} onChange={(e) => setField("training", e.target.value as Training)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white">
              <option value="gym">Gym</option>
              <option value="boxing">Boxing</option>
              <option value="both">Both</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Training days / week
            <input value={form.trainingDays} onChange={(e) => setField("trainingDays", e.target.value)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white" required />
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Sleep by (HH:MM)
            <input type="time" value={form.sleepBy} onChange={(e) => setField("sleepBy", e.target.value)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white" required />
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Wake at (HH:MM)
            <input type="time" value={form.wakeAt} onChange={(e) => setField("wakeAt", e.target.value)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white" required />
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Diet preference
            <select value={form.dietPreference} onChange={(e) => setField("dietPreference", e.target.value as DietPref)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white">
              <option value="high_protein">High protein</option>
              <option value="balanced">Balanced</option>
              <option value="vegetarian">Vegetarian</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/80">
            Current activity
            <select value={form.activity} onChange={(e) => setField("activity", e.target.value as Activity)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white">
              <option value="low">Low</option>
              <option value="med">Med</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm text-white/80 md:col-span-2">
            Biggest issue
            <select value={form.biggestIssue} onChange={(e) => setField("biggestIssue", e.target.value as Issue)} className="rounded-md border border-white/15 bg-black/25 px-3 py-2 text-white">
              <option value="overeating">Overeating</option>
              <option value="consistency">Consistency</option>
              <option value="sleep">Sleep</option>
              <option value="motivation">Motivation</option>
            </select>
          </label>

          {error ? (
            <p className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100 md:col-span-2">{error}</p>
          ) : null}

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={saving} className="chrome-btn px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "Saving..." : "Finish"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
