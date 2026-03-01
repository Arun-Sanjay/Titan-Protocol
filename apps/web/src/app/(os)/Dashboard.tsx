"use client";

import * as React from "react";
import Link from "next/link";

import type { EngineName } from "../../lib/db";
import {
  calculateTitanScore,
  getEngineDashboardStats,
} from "../../lib/api";
import { playClick } from "../../lib/sound";

type TitanScoreState = Awaited<ReturnType<typeof calculateTitanScore>>;
type EngineStatsState = Awaited<ReturnType<typeof getEngineDashboardStats>>;

type EngineCardModel = {
  key: EngineName;
  label: string;
  route: string;
  todayPct: number;
  dayIndex: number;
  totalDays: number;
  consistencyPct: number;
  isActive: boolean;
};

const ENGINE_KEYS: EngineName[] = ["body", "mind", "money", "general"];

const ENGINE_LABELS: Record<EngineName, string> = {
  body: "Body",
  mind: "Mind",
  money: "Money",
  general: "General",
};

const ENGINE_ROUTES: Record<EngineName, string> = {
  body: "/os/body",
  mind: "/os/mind",
  money: "/os/money",
  general: "/os/general",
};

export default function Dashboard() {
  const [score, setScore] = React.useState<TitanScoreState | null>(null);
  const [engineCards, setEngineCards] = React.useState<EngineCardModel[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextScore, stats] = await Promise.all([
        calculateTitanScore(),
        Promise.all(ENGINE_KEYS.map((engineName) => getEngineDashboardStats(engineName))),
      ]);

      const statsMap = new Map(stats.map((item) => [item.engineName, item] as const));
      const cards = ENGINE_KEYS.map((key): EngineCardModel => {
        const engineStats: EngineStatsState | undefined = statsMap.get(key);
        return {
          key,
          label: ENGINE_LABELS[key],
          route: ENGINE_ROUTES[key],
          todayPct: engineStats?.todayCompletionPct ?? 0,
          dayIndex: engineStats?.dayIndex ?? 0,
          totalDays: engineStats?.totalDays ?? 0,
          consistencyPct: engineStats?.consistencyPct ?? 0,
          isActive: engineStats?.isActive ?? false,
        };
      });

      setScore(nextScore);
      setEngineCards(cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeBreakdown = score?.breakdown ?? [];

  return (
    <main className="hud-root w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-6">
        <h1 className="hud-title text-3xl font-bold md:text-4xl">Titan Protocol OS</h1>
      </header>

      <section className="space-y-5">
        {loading ? <p className="text-white/80">Loading dashboard...</p> : null}

        {!loading && error ? (
          <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="hud-panel p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">Titan Score</p>
                  <p className="mt-1 text-3xl font-semibold text-white">
                    {(score?.titanScore ?? 0).toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-white/60">Active Engines: {score?.activeEnginesCount ?? 0}</p>
              </div>
              <div className="mt-4 space-y-3">
                {activeBreakdown.length === 0 ? (
                  <p className="text-sm text-white/65">No active engines yet.</p>
                ) : (
                  activeBreakdown.map((item) => (
                    <div key={item.engineName}>
                      <div className="mb-1 flex items-center justify-between text-xs text-white/75">
                        <span>{item.engineName.toUpperCase()}</span>
                        <span>{item.score.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-white/70 transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {engineCards.map((card) => (
                <article key={card.key} className="hud-panel p-5">
                  <p className="text-lg font-semibold text-white">{card.label}</p>
                  {card.isActive ? (
                    <div className="mt-3 space-y-2 text-sm text-white/85">
                      <p>
                        Today Completion:{" "}
                        <span className="font-semibold text-white">{card.todayPct.toFixed(0)}%</span>
                      </p>
                      <p>
                        Cycle Day:{" "}
                        <span className="font-semibold text-white">
                          {card.dayIndex}/{card.totalDays}
                        </span>
                      </p>
                      <p>
                        Cycle Consistency:{" "}
                        <span className="font-semibold text-white">
                          {card.consistencyPct.toFixed(0)}%
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 min-h-16 text-sm text-white/65">
                      Set up your Plan in Settings.
                    </p>
                  )}
                  <Link
                    href={card.route}
                    onClick={playClick}
                    className="hud-btn mt-4 inline-flex w-full items-center justify-center px-3 py-2 text-sm font-semibold text-white"
                  >
                    Open
                  </Link>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
