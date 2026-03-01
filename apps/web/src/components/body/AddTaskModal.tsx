"use client";

import * as React from "react";

import type { BodyTaskKind } from "../../lib/db";

type AddTaskModalProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    kind: BodyTaskKind;
    target_value: number | null;
    target_unit: string | null;
  }) => Promise<void>;
};

const UNIT_OPTIONS = ["reps", "min", "L", "steps", "kcal", "g"] as const;

export function AddTaskModal({ open, saving, onClose, onSave }: AddTaskModalProps) {
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<BodyTaskKind>("habit");
  const [targetValue, setTargetValue] = React.useState("");
  const [targetUnit, setTargetUnit] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setKind("habit");
      setTargetValue("");
      setTargetUnit("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }

    const parsedTarget =
      targetValue.trim().length > 0 && Number.isFinite(Number(targetValue))
        ? Math.max(0, Math.round(Number(targetValue)))
        : null;
    try {
      await onSave({
        title: trimmedTitle,
        kind,
        target_value: parsedTarget,
        target_unit: targetUnit.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={(event) => void handleSubmit(event)} className="hud-panel w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Adjustable Task</h3>
          <button type="button" onClick={onClose} className="text-xs text-white/70 hover:text-white">
            Close
          </button>
        </div>

        {error ? <p className="mb-3 rounded-md border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-100">{error}</p> : null}

        <label className="mb-3 block text-xs uppercase tracking-wide text-white/70">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
            placeholder="e.g. Walk 20 minutes"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase tracking-wide text-white/70">
            Kind
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as BodyTaskKind)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
            >
              <option value="habit">Habit</option>
              <option value="nutrition">Nutrition</option>
              <option value="training">Training</option>
            </select>
          </label>

          <label className="block text-xs uppercase tracking-wide text-white/70">
            Target Value
            <input
              type="number"
              min={0}
              value={targetValue}
              onChange={(event) => setTargetValue(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
              placeholder="Optional"
            />
          </label>
        </div>

        <label className="mt-3 block text-xs uppercase tracking-wide text-white/70">
          Target Unit
          <select
            value={targetUnit}
            onChange={(event) => setTargetUnit(event.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
          >
            <option value="">None</option>
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="hud-btn px-3 py-1.5 text-xs text-white/85">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
