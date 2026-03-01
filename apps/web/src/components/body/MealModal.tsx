"use client";

import * as React from "react";

type MealInput = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type MealSubmit = {
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

function toOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

export function MealModal({
  open,
  title,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: MealInput;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: MealSubmit) => Promise<void> | void;
}) {
  const [form, setForm] = React.useState<MealInput>({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      initial ?? {
        name: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
      },
    );
    setError(null);
  }, [initial, open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const calories = Number(form.calories);
    if (!name) {
      setError("Meal name is required.");
      return;
    }
    if (!Number.isFinite(calories) || calories <= 0) {
      setError("Calories are required.");
      return;
    }
    setError(null);
    await onSubmit({
      name,
      calories: Math.round(calories),
      protein: toOptionalNumber(form.protein),
      carbs: toOptionalNumber(form.carbs),
      fat: toOptionalNumber(form.fat),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-3 py-6">
      <div className="chrome-panel w-full max-w-lg p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/65 transition hover:text-white"
            disabled={saving}
          >
            Close
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm text-white/80">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              autoFocus
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm text-white/80">
              <span>Calories</span>
              <input
                type="number"
                min={0}
                value={form.calories}
                onChange={(event) => setForm((prev) => ({ ...prev, calories: event.target.value }))}
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              />
            </label>
            <label className="block space-y-1 text-sm text-white/80">
              <span>Protein (optional)</span>
              <input
                type="number"
                min={0}
                value={form.protein}
                onChange={(event) => setForm((prev) => ({ ...prev, protein: event.target.value }))}
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              />
            </label>
            <label className="block space-y-1 text-sm text-white/80">
              <span>Carbs (optional)</span>
              <input
                type="number"
                min={0}
                value={form.carbs}
                onChange={(event) => setForm((prev) => ({ ...prev, carbs: event.target.value }))}
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              />
            </label>
            <label className="block space-y-1 text-sm text-white/80">
              <span>Fat (optional)</span>
              <input
                type="number"
                min={0}
                value={form.fat}
                onChange={(event) => setForm((prev) => ({ ...prev, fat: event.target.value }))}
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="chrome-btn px-3 py-2 text-sm text-white"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="chrome-btn px-3 py-2 text-sm text-white" disabled={saving}>
              {saving ? "Saving..." : "Save Meal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
