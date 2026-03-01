"use client";

import * as React from "react";
import Link from "next/link";

import { db, type CycleRecord } from "../../../../../lib/db";
import { getEngineByName } from "../../../../../lib/api";

type CycleRow = CycleRecord & { id: number };

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

export default function DebugCyclesPage() {
  const [cycles, setCycles] = React.useState<CycleRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const isDev = process.env.NODE_ENV !== "production";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await db.cycles.toArray();
      const rows = all
        .filter((cycle): cycle is CycleRow => typeof cycle.id === "number")
        .sort((a, b) => b.start_date.localeCompare(a.start_date));
      setCycles(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function withBodyEngineId(action: (engineId: number) => Promise<void>) {
    const body = await getEngineByName("body");
    if (!body?.id) {
      setMessage("Body engine not found.");
      return;
    }
    await action(body.id);
  }

  async function handleArchiveAllBody() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await withBodyEngineId(async (engineId) => {
        const bodyCycles = await db.cycles
          .where("engine_id")
          .equals(engineId)
          .filter((cycle) => cycle.is_archived !== true)
          .toArray();
        for (const cycle of bodyCycles) {
          if (!cycle.id) continue;
          await db.cycles.update(cycle.id, {
            is_archived: true,
            is_active: false,
            is_primary: false,
            archived_at: new Date().toISOString(),
            end_date: cycle.end_date || new Date().toISOString().slice(0, 10),
          });
        }
      });
      setMessage("Archived all non-archived body cycles.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAllBody() {
    if (!isDev) return;
    if (!window.confirm("Delete all body cycles? This cannot be undone.")) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await withBodyEngineId(async (engineId) => {
        const ids = await db.cycles.where("engine_id").equals(engineId).primaryKeys();
        await db.cycles.bulkDelete(ids as number[]);
      });
      setMessage("Deleted all body cycles.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Debug Cycles</h1>
          <p className="mt-2 text-sm text-white/70">Truth source for cycle records in IndexedDB.</p>
        </div>
        <Link href="/os" className="hud-btn px-3 py-1.5 text-sm text-white">
          Back to OS
        </Link>
      </header>

      <section className="hud-panel p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleArchiveAllBody()}
            className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Force archive all non-archived cycles for engineId=body
          </button>
          {isDev ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDeleteAllBody()}
              className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Force delete all cycles for engineId=body (dev)
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="hud-btn px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading ? <p className="text-sm text-white/75">Loading cycles...</p> : null}
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p className="mb-3 text-sm text-emerald-200">{message}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs text-white/85">
            <thead>
              <tr className="border-b border-white/15 text-left text-white/65">
                <th className="px-2 py-2">id</th>
                <th className="px-2 py-2">engineId</th>
                <th className="px-2 py-2">moduleId</th>
                <th className="px-2 py-2">name</th>
                <th className="px-2 py-2">isArchived</th>
                <th className="px-2 py-2">isActive</th>
                <th className="px-2 py-2">startDate</th>
                <th className="px-2 py-2">endDate</th>
                <th className="px-2 py-2">archivedAt</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.id} className="border-b border-white/10">
                  <td className="px-2 py-2">{cycle.id}</td>
                  <td className="px-2 py-2">{cycle.engine_id}</td>
                  <td className="px-2 py-2">{formatValue(cycle.module_id)}</td>
                  <td className="px-2 py-2">{cycle.title}</td>
                  <td className="px-2 py-2">{String(cycle.is_archived === true)}</td>
                  <td className="px-2 py-2">{String(cycle.is_active === true)}</td>
                  <td className="px-2 py-2">{formatValue(cycle.start_date)}</td>
                  <td className="px-2 py-2">{formatValue(cycle.end_date)}</td>
                  <td className="px-2 py-2">{formatValue(cycle.archived_at)}</td>
                </tr>
              ))}
              {!loading && cycles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-3 text-center text-white/60">
                    No cycles found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
