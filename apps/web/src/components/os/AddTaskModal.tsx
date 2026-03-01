"use client";

import * as React from "react";

export function AddTaskModal({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: { title: string; is_non_negotiable: boolean }) => Promise<void> | void;
}) {
  const [title, setTitle] = React.useState("");
  const [isNonNegotiable, setIsNonNegotiable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setIsNonNegotiable(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Task title is required.");
      return;
    }
    setError(null);
    await onSubmit({ title: trimmed, is_non_negotiable: isNonNegotiable });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-3">
      <div className="chrome-panel w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Add Task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-white/65 transition hover:text-white"
            disabled={saving}
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm text-white/80">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/35"
              autoFocus
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-white/85">
            <input
              type="checkbox"
              checked={isNonNegotiable}
              onChange={(event) => setIsNonNegotiable(event.target.checked)}
              className="h-4 w-4 accent-white"
            />
            Non-negotiable
          </label>

          {error ? (
            <p className="rounded-md border border-red-400/40 bg-red-500/10 p-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="chrome-btn px-3 py-2 text-sm text-white"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="chrome-btn px-3 py-2 text-sm text-white" disabled={saving}>
              {saving ? "Saving..." : "Save Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
