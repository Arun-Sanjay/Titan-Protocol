"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";

import { todayISO } from "@/lib/date";
import { EMPTY_SCORE, type TitanScore, type EngineKey } from "@/lib/scoring";
import { playClick } from "@/lib/sound";
import {
  getDailyPlanningModel,
  getWeekScores,
  getWeekComparison,
  getWeekTaskStats,
  type DailyPlanningModel,
  type WeekScoreEntry,
  type WeekComparisonEntry,
  type WeekTaskStats,
} from "@/lib/dashboard-stats";
import {
  TitanActionLink,
  TitanMetric,
  TitanPageHeader,
  TitanPanel,
  TitanPanelHeader,
  TitanProgress,
} from "@/components/ui/titan-primitives";

type EngineCardModel = {
  key: "body" | "mind" | "money" | "general";
  label: string;
  route: string;
  scorePct: number;
  planLabel: string;
  dayLabel: string;
};

const DEFAULT_TITAN: TitanScore = {
  percent: 0,
  perEngine: { body: EMPTY_SCORE, mind: EMPTY_SCORE, money: EMPTY_SCORE, general: EMPTY_SCORE },
  enginesActiveCount: 0,
};

type DashboardWeekData = {
  sparklines: Record<EngineKey, WeekScoreEntry[]>;
  comparison: WeekComparisonEntry[];
  taskStats: WeekTaskStats;
};

const DEFAULT_WEEK_DATA: DashboardWeekData = {
  sparklines: {
    body: [],
    mind: [],
    money: [],
    general: [],
  },
  comparison: [],
  taskStats: { totalCompleted: 0, bestDay: { dateKey: todayISO(), percent: 0 } },
};

const DEFAULT_PLANNING: DailyPlanningModel = {
  dateKey: todayISO(),
  titan: DEFAULT_TITAN,
  summary: {
    completedPoints: 0,
    totalPoints: 0,
    incompleteMainCount: 0,
  },
  enginesAtRisk: [],
  topIncompleteMainTasks: [],
  nextBestAction: {
    title: "Lock momentum with a focus block",
    detail: "No urgent risks detected. Convert the day into deep output.",
    href: "/os/focus",
    cta: "Start focus",
  },
  quickActions: [],
};

const RADAR_HEIGHT = 220;

function formatDateShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const planning = useLiveQuery(() => getDailyPlanningModel(todayKey), [todayKey]) ?? DEFAULT_PLANNING;
  const titan = planning.titan;

  const weekData =
    useLiveQuery<DashboardWeekData>(
      async () => {
        const [bodySpark, mindSpark, moneySpark, generalSpark, comparison, taskStats] = await Promise.all([
          getWeekScores("body"),
          getWeekScores("mind"),
          getWeekScores("money"),
          getWeekScores("general"),
          getWeekComparison(),
          getWeekTaskStats(),
        ]);

        return {
          sparklines: {
            body: bodySpark,
            mind: mindSpark,
            money: moneySpark,
            general: generalSpark,
          },
          comparison,
          taskStats,
        };
      },
      [todayKey],
    ) ?? DEFAULT_WEEK_DATA;

  const engineCards: EngineCardModel[] = React.useMemo(() => {
    const pe = titan.perEngine;
    return [
      {
        key: "body",
        label: "Body",
        route: "/os/body",
        scorePct: pe.body.percent,
        planLabel: pe.body.pointsTotal > 0 ? `Today: ${pe.body.percent}%` : "Plan not set",
        dayLabel: pe.body.pointsTotal > 0 ? `${pe.body.pointsDone}/${pe.body.pointsTotal} pts` : "0/0 pts",
      },
      {
        key: "mind",
        label: "Mind",
        route: "/os/mind",
        scorePct: pe.mind.percent,
        planLabel: pe.mind.pointsTotal > 0 ? `Today: ${pe.mind.percent}%` : "Plan not set",
        dayLabel: pe.mind.pointsTotal > 0 ? `${pe.mind.pointsDone}/${pe.mind.pointsTotal} pts` : "0/0 pts",
      },
      {
        key: "money",
        label: "Money",
        route: "/os/money",
        scorePct: pe.money.percent,
        planLabel: pe.money.pointsTotal > 0 ? `Today: ${pe.money.percent}%` : "Plan not set",
        dayLabel: pe.money.pointsTotal > 0 ? `${pe.money.pointsDone}/${pe.money.pointsTotal} pts` : "0/0 pts",
      },
      {
        key: "general",
        label: "General",
        route: "/os/general",
        scorePct: pe.general.percent,
        planLabel: pe.general.pointsTotal > 0 ? `Today: ${pe.general.percent}%` : "Plan not set",
        dayLabel: pe.general.pointsTotal > 0 ? `${pe.general.pointsDone}/${pe.general.pointsTotal} pts` : "0/0 pts",
      },
    ];
  }, [titan]);

  const radarData = React.useMemo(() => {
    const pe = titan.perEngine;
    return [
      { subject: "Body", score: pe.body.percent },
      { subject: "Mind", score: pe.mind.percent },
      { subject: "Money", score: pe.money.percent },
      { subject: "General", score: pe.general.percent },
    ];
  }, [titan]);

  const thisWeekAvg = React.useMemo(() => {
    if (weekData.comparison.length === 0) return 0;
    const activeComps = weekData.comparison.filter((c) => c.thisWeekAvg > 0 || c.lastWeekAvg > 0);
    if (activeComps.length === 0) return 0;
    return Math.round(activeComps.reduce((sum, c) => sum + c.thisWeekAvg, 0) / activeComps.length);
  }, [weekData.comparison]);


  return (
    <main className="tx-dashboard w-full px-2 py-2 sm:px-4 sm:py-4">
      <TitanPageHeader
        kicker="Titan Protocol"
        title="Titan OS"
        subtitle="Your performance operating system — four engines, one view."
      />

      <section className="tx-dashboard-grid">
        <div className="tx-dashboard-top">
          <TitanPanel tone="hero" className="tx-dashboard-card tx-dashboard-hero">
            <div className="tx-score-head">
              <div>
                <p className="tx-kicker">Titan Score</p>
                <p className="tx-score-main tx-display">{titan.percent.toFixed(1)}%</p>
                <p className="tx-muted">{titan.enginesActiveCount}/4 engines active today</p>
              </div>
            </div>

            <div className="tx-score-grid">
              {engineCards.map((item) => (
                <div key={item.key}>
                  <div className="tx-score-row-head">
                    <span>{item.label}</span>
                    <span>{item.scorePct.toFixed(1)}%</span>
                  </div>
                  <TitanProgress value={item.scorePct} />
                </div>
              ))}
            </div>
          </TitanPanel>

          {weekData.comparison.length > 0 && (
            <TitanPanel className="tx-dashboard-card tx-dashboard-compare">
              <TitanPanelHeader kicker="vs Last Week" />
              <div className="tx-comparison-grid mt-3">
                {weekData.comparison.map((entry) => {
                  const improved = entry.change >= 0;
                  return (
                    <div key={entry.engine} className="tx-comparison-card">
                      <p className="tx-kicker">{entry.engine}</p>
                      <p className={`tx-comparison-value ${improved ? "is-up" : "is-down"}`}>
                        {improved ? "↑" : "↓"} {Math.abs(entry.change)}%
                      </p>
                      <p className="tx-muted">
                        {entry.thisWeekAvg}% vs {entry.lastWeekAvg}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </TitanPanel>
          )}

          <TitanPanel className="tx-dashboard-card tx-dashboard-radar">
            <TitanPanelHeader kicker="Engine Overview" />
            <div className="tx-dashboard-radar-chart">
              <ResponsiveContainer width="100%" height={RADAR_HEIGHT}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                  <PolarGrid stroke="rgba(255,255,255,0.07)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "rgba(233,240,255,0.60)", fontSize: 10, letterSpacing: "0.08em" }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="score"
                    stroke="rgba(222,231,243,0.80)"
                    fill="rgba(222,231,243,0.15)"
                    strokeWidth={1.5}
                    dot={{ fill: "rgba(222,231,243,0.80)", r: 2 }}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </TitanPanel>
        </div>

        <div className="tx-engine-grid">
          {engineCards.map((card) => (
            <TitanPanel key={card.key} as="article" tone="subtle" className="tx-engine-card tx-dashboard-card">
              <div className="tx-engine-top">
                <h2 className="tx-engine-title">{card.label}</h2>
                <p className="tx-engine-score tx-display">{card.scorePct.toFixed(0)}%</p>
              </div>

              {weekData.sparklines[card.key].length > 0 ? (
                <div className="tx-engine-chart">
                  <ResponsiveContainer width="100%" height={40}>
                    <LineChart data={weekData.sparklines[card.key]}>
                      <Line
                        type="monotone"
                        dataKey="percent"
                        stroke="rgba(222,231,243,0.95)"
                        strokeWidth={1.8}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              <p className="tx-engine-line">{card.planLabel}</p>
              <p className="tx-engine-line">{card.dayLabel}</p>
              <TitanActionLink href={card.route} onClick={playClick} compact>
                Enter
              </TitanActionLink>
            </TitanPanel>
          ))}
        </div>

        <TitanPanel className="tx-dashboard-card tx-dashboard-snapshot">
          <TitanPanelHeader kicker="This Week" />
          <div className="tx-summary-grid mt-3">
            <TitanMetric label="Avg Titan Score" value={`${thisWeekAvg}%`} />
            <TitanMetric label="Tasks Completed" value={weekData.taskStats.totalCompleted} />
            <TitanMetric
              label="Best Day"
              value={`${weekData.taskStats.bestDay.percent}%`}
              meta={formatDateShort(weekData.taskStats.bestDay.dateKey)}
            />
          </div>
        </TitanPanel>

        <TitanPanel tone="hero" className="tx-dashboard-card tx-dashboard-today">
          <div className="tx-planning-head">
            <div>
              <p className="tx-kicker">Today Planner</p>
              <h2 className="tx-planning-title">Personal Command Layer</h2>
              <p className="tx-muted">Planning date · {planning.dateKey}</p>
            </div>
            <div className="tx-planning-stat">
              <p className="tx-kicker">Main Tasks Open</p>
              <p className="tx-planning-stat-value tx-display">{planning.summary.incompleteMainCount}</p>
            </div>
          </div>

          <div className="tx-planning-grid">
            <div className="tx-planning-block tx-planning-block--summary">
              <p className="tx-kicker">Titan Score Summary</p>
              <p className="tx-planning-percent tx-display">{titan.percent.toFixed(1)}%</p>
              <p className="tx-muted">
                {planning.summary.completedPoints}/{planning.summary.totalPoints} points · {titan.enginesActiveCount}/4 engines active
              </p>
            </div>

            <div className="tx-planning-block">
              <p className="tx-kicker">Engines At Risk</p>
              {planning.enginesAtRisk.length > 0 ? (
                <div className="tx-planning-list">
                  {planning.enginesAtRisk.map((risk) => (
                    <div key={risk.engine} className="tx-planning-item">
                      <div>
                        <p className="tx-planning-item-title">
                          {risk.label} · {risk.scorePct}%
                        </p>
                        <p className="tx-muted">{risk.reason}</p>
                      </div>
                      <TitanActionLink href={risk.route} onClick={playClick} compact>
                        Open
                      </TitanActionLink>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tx-muted">All engines are above threshold.</p>
              )}
            </div>

            <div className="tx-planning-block">
              <p className="tx-kicker">Top Incomplete Main Tasks</p>
              {planning.topIncompleteMainTasks.length > 0 ? (
                <div className="tx-planning-list">
                  {planning.topIncompleteMainTasks.map((task) => (
                    <div key={task.id} className="tx-planning-item">
                      <div>
                        <p className="tx-planning-item-title">{task.title}</p>
                        <p className="tx-muted">{task.engineLabel}</p>
                      </div>
                      <TitanActionLink href={task.route} onClick={playClick} compact>
                        Enter
                      </TitanActionLink>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tx-muted">No incomplete main tasks detected.</p>
              )}
            </div>

            <div className="tx-planning-block tx-planning-block--next">
              <p className="tx-kicker">Next Best Action</p>
              <p className="tx-planning-item-title">{planning.nextBestAction.title}</p>
              <p className="tx-muted">{planning.nextBestAction.detail}</p>
              <TitanActionLink href={planning.nextBestAction.href} onClick={playClick} compact>
                {planning.nextBestAction.cta}
              </TitanActionLink>
            </div>

            <div className="tx-planning-block tx-planning-block--quick">
              <p className="tx-kicker">Quick Actions</p>
              <div className="tx-planning-actions">
                {planning.quickActions.map((action) => (
                  <TitanActionLink key={action.href} href={action.href} onClick={playClick} compact>
                    {action.label}
                  </TitanActionLink>
                ))}
              </div>
            </div>
          </div>
        </TitanPanel>
      </section>
    </main>
  );
}
