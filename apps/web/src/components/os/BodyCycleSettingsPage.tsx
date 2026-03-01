"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  archiveCycle,
  calculateCycleConsistency,
  extendCycle,
  getOrCreateEngine,
  getPrimaryCycle,
} from "../../lib/api";

type ActiveCycleState = {
  id: number;
  title: string;
  durationDays: number;
  startDate: string;
  dayIndex: number;
  totalDays: number;
  consistencyPct: number;
};

const TIMEFRAME_OPTIONS = [30, 60, 90, 180, 365] as const;

export function BodyCycleSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [cycle, setCycle] = React.useState<ActiveCycleState | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = React.useState<number>(90);

  const loadCycle = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bodyEngine = await getOrCreateEngine("body");
      const activeCycle = await getPrimaryCycle(bodyEngine.id as number);

      if (!activeCycle?.id) {
        setCycle(null);
        return;
      }

      const stats = await calculateCycleConsistency(activeCycle.id);
      setCycle({
        id: activeCycle.id,
        title: activeCycle.title,
        durationDays: activeCycle.duration_days,
        startDate: activeCycle.start_date,
        dayIndex: stats.dayIndex,
        totalDays: stats.totalDays,
        consistencyPct: Math.round(stats.consistency * 10) / 10,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCycle();
  }, [loadCycle]);

  async function handleExtend(days: 30 | 60 | 90) {
    if (!cycle) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await extendCycle(cycle.id, days);
      await loadCycle();
      setMessage(`Timeframe extended by ${days} days.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!cycle) return;
    const confirmArchive = window.confirm("Archive this Body cycle now?");
    if (!confirmArchive) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await archiveCycle(cycle.id);
      await loadCycle();
      setMessage("Cycle archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleCreateContinue() {
    router.push(`/os/body/intake?timeframe=${selectedTimeframe}`);
  }

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hud-title text-3xl font-bold md:text-4xl">Body Settings</h1>
          <p className="mt-2 text-sm text-white/70">Manage your Body cycle from here.</p>
        </div>
        <Link href="/os/body" className="chrome-btn px-3 py-1.5 text-sm text-white">
          Back to Body
        </Link>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>
      ) : null}

      {message ? (
        <p className="mb-4 rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</p>
      ) : null}

      {loading ? <p className="text-sm text-white/70">Loading cycle...</p> : null}

      {!loading && !cycle ? (
        <section className="chrome-panel p-8 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">Body Cycle</p>
          <p className="mt-3 text-lg font-semibold text-white">No active cycle</p>
          <p className="mt-2 text-sm text-white/65">Create a new Body cycle to start tracking days and consistency.</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="chrome-btn mt-6 inline-flex px-5 py-2 text-sm text-white"
          >
            Create New Body Cycle
          </button>
        </section>
      ) : null}

      {!loading && cycle ? (
        <section className="chrome-panel p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">Active Cycle</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{cycle.title}</h2>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="chrome-outline rounded-lg bg-white/[0.03] p-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-white/55">Length</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{cycle.durationDays} days</dd>
            </div>
            <div className="chrome-outline rounded-lg bg-white/[0.03] p-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-white/55">Start Date</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{cycle.startDate}</dd>
            </div>
            <div className="chrome-outline rounded-lg bg-white/[0.03] p-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-white/55">Day</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{cycle.dayIndex}/{cycle.totalDays}</dd>
            </div>
            <div className="chrome-outline rounded-lg bg-white/[0.03] p-3">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-white/55">Consistency</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{cycle.consistencyPct}%</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleExtend(30)}
              disabled={busy}
              className="chrome-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Extend +30
            </button>
            <button
              type="button"
              onClick={() => void handleExtend(60)}
              disabled={busy}
              className="chrome-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Extend +60
            </button>
            <button
              type="button"
              onClick={() => void handleExtend(90)}
              disabled={busy}
              className="chrome-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Extend +90
            </button>
            <button
              type="button"
              onClick={() => void handleArchive()}
              disabled={busy}
              className="chrome-btn px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Archive Cycle
            </button>
          </div>
        </section>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true">
          <div className="chrome-panel w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-white">Create New Body Cycle</h3>
            <p className="mt-2 text-sm text-white/70">Choose your timeframe and continue to intake.</p>

            <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-white/60">Timeframe</label>
            <select
              value={selectedTimeframe}
              onChange={(event) => setSelectedTimeframe(Number(event.target.value))}
              className="mt-2 w-full rounded-md border border-white/15 bg-black/25 px-3 py-2 text-sm text-white"
            >
              {TIMEFRAME_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} days
                </option>
              ))}
            </select>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="chrome-btn px-3 py-1.5 text-sm text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateContinue}
                className="chrome-btn px-3 py-1.5 text-sm text-white"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
