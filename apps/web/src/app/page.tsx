"use client";

import * as React from "react";

import { NeonCard } from "../components/NeonCard";
import { apiGet, completeQuest, getQuests } from "../lib/api";

type ProgressResponse = {
  user_id: string;
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next_level: number;
  rank: string;
};

type Quest = {
  id: string;
  title: string;
  type: "main" | "side" | "daily" | string;
  xp_reward: number;
  is_completed: boolean;
};

export default function Home() {
  const [progress, setProgress] = React.useState<ProgressResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [awarding, setAwarding] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quests, setQuests] = React.useState<Quest[]>([]);
  const [questsLoading, setQuestsLoading] = React.useState<boolean>(true);
  const [questsError, setQuestsError] = React.useState<string | null>(null);

  async function loadProgress() {
    setLoading(true);
    setError(null);
    try {
      const data = (await apiGet("/progress")) as ProgressResponse;
      setProgress(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadProgress();
  }, []);

  async function loadQuests() {
    setQuestsLoading(true);
    setQuestsError(null);
    try {
      const data = (await getQuests()) as unknown;
      if (!Array.isArray(data)) {
        throw new Error("Invalid quests response");
      }
      setQuests(
        data.map((q) => ({
          id: String((q as any).id),
          title: String((q as any).title ?? ""),
          type: String((q as any).type ?? ""),
          xp_reward: Number((q as any).xp_reward ?? 0),
          is_completed: Boolean((q as any).is_completed ?? false),
        })),
      );
    } catch (e) {
      setQuestsError(e instanceof Error ? e.message : String(e));
    } finally {
      setQuestsLoading(false);
    }
  }

  React.useEffect(() => {
    void loadQuests();
  }, []);

  const pct =
    progress && progress.xp_for_next_level > 0
      ? Math.max(
          0,
          Math.min(1, progress.xp_into_level / progress.xp_for_next_level),
        )
      : 0;

  async function awardXp() {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
      setError("Missing NEXT_PUBLIC_API_URL");
      return;
    }

    setAwarding(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/xp/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta_xp: 200, reason: "frontend test" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`POST /xp/award failed: ${res.status} ${text}`.trim());
      }
      await loadProgress();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAwarding(false);
    }
  }

  async function onCompleteQuest(id: string) {
    try {
      await completeQuest(id);
      await loadQuests();
    } catch (e) {
      setQuestsError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-cyan-200">
          TITAN PROTOCOL
        </h1>
        <p className="mt-2 text-sm text-cyan-200/70">
          Neon/HUD life gamification system
        </p>
      </div>

      <NeonCard>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/70">Rank • Level</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {loading ? "Loading…" : `${progress?.rank ?? "—"} • ${progress?.level ?? "—"}`}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void awardXp()}
            disabled={loading || awarding}
            className="rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.18)] hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {awarding ? "Awarding…" : "Award +200 XP"}
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <div className="text-sm text-white/70">XP</div>
            <div className="text-sm text-cyan-100/90">
              {loading
                ? "—"
                : `${progress?.xp_into_level ?? 0} / ${progress?.xp_for_next_level ?? 0}`}
            </div>
          </div>

          <div className="mt-2 h-3 w-full rounded-full bg-slate-900/80 ring-1 ring-cyan-300/20">
            <div
              className="h-3 rounded-full bg-cyan-400"
              style={{
                width: `${Math.round(pct * 100)}%`,
                boxShadow: "0 0 18px rgba(34,211,238,0.35)",
              }}
            />
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </NeonCard>

      <div className="mt-8" />

      <NeonCard>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/70">Quests</div>
            <div className="mt-1 text-xl font-semibold text-white">
              {questsLoading ? "Loading…" : `${quests.length} found`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadQuests()}
            disabled={questsLoading}
            className="rounded-lg border border-cyan-300/50 bg-cyan-500/5 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {questsError ? (
          <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
            {questsError}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {questsLoading ? (
            <div className="text-sm text-white/60">Fetching quests…</div>
          ) : quests.length === 0 ? (
            <div className="text-sm text-white/60">No quests yet.</div>
          ) : (
            quests.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-cyan-300/15 bg-slate-950/40 px-4 py-3"
              >
                <div>
                  <div className="text-base font-semibold text-white">
                    {q.title}
                  </div>
                  <div className="mt-1 text-xs text-white/70">
                    <span className="text-cyan-200/90">{q.type}</span>
                    <span className="mx-2 text-white/30">•</span>
                    <span className="text-cyan-200/90">{q.xp_reward} XP</span>
                    <span className="mx-2 text-white/30">•</span>
                    <span className={q.is_completed ? "text-emerald-200" : "text-white/70"}>
                      {q.is_completed ? "COMPLETED" : "INCOMPLETE"}
                    </span>
                  </div>
                </div>

                {q.is_completed ? null : (
                  <button
                    type="button"
                    onClick={() => void onCompleteQuest(q.id)}
                    className="rounded-lg border border-cyan-300/60 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
                  >
                    Complete
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </NeonCard>
    </main>
  );
}
