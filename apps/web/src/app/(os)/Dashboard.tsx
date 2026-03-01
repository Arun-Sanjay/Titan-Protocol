"use client";

import Link from "next/link";

import { playClick } from "../../lib/sound";

type EngineCardModel = {
  key: "body" | "mind" | "money" | "general";
  label: string;
  route: string;
  scorePct: number;
  planLabel: string;
  dayLabel: string;
};

const ENGINE_CARDS: EngineCardModel[] = [
  { key: "body", label: "Body", route: "/os/body", scorePct: 0, planLabel: "Plan: Not set up", dayLabel: "Day 0/0" },
  { key: "mind", label: "Mind", route: "/os/mind", scorePct: 0, planLabel: "Plan: Not set up", dayLabel: "Day 0/0" },
  { key: "money", label: "Money", route: "/os/money", scorePct: 0, planLabel: "Plan: Not set up", dayLabel: "Day 0/0" },
  { key: "general", label: "General", route: "/os/general", scorePct: 0, planLabel: "Plan: Not set up", dayLabel: "Day 0/0" },
];

export default function Dashboard() {
  return (
    <main className="tp-dash w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-7">
        <p className="tp-kicker">Titan Protocol</p>
        <h1 className="tp-title">Titan Protocol OS</h1>
        <p className="tp-subtitle">Command overview for Body, Mind, Money, and General engines.</p>
      </header>

      <section className="space-y-5">
        <article className="tp-panel titan-card p-5 sm:p-6">
          <div className="tp-panel-head">
            <div>
              <p className="tp-kicker">Titan Score</p>
              <p className="tp-score-value">0.0%</p>
            </div>
            <p className="tp-muted">0/4 engines active</p>
          </div>

          <div className="tp-score-grid mt-5">
            {ENGINE_CARDS.map((item) => (
              <div key={item.key} className="tp-score-row">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/72">
                  <span className="tracking-[0.18em]">{item.label.toUpperCase()}</span>
                  <span>{item.scorePct.toFixed(1)}%</span>
                </div>
                <div className="tp-progress">
                  <span style={{ width: `${Math.max(0, Math.min(100, item.scorePct))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="tp-engine-grid">
          {ENGINE_CARDS.map((card) => (
            <article key={card.key} className="tp-tile titan-card">
              <div className="flex items-start justify-between gap-3">
                <h2 className="tp-tile-title">{card.label}</h2>
                <p className="tp-tile-score">{card.scorePct.toFixed(0)}%</p>
              </div>
              <p className="tp-line mt-3">{card.planLabel}</p>
              <p className="tp-line">{card.dayLabel}</p>
              <Link
                href={card.route}
                onClick={playClick}
                className="tp-button"
              >
                Enter
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
