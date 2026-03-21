"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { LazyRechartsProvider, preloadRecharts } from "@/components/ui/LazyRecharts";

import { todayISO, addDaysISO } from "@/lib/date";
import { EMPTY_SCORE, ENGINES, type TitanScore, type EngineKey, getDateRangeScoresForAllEngines } from "@/lib/scoring";
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
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { useTheme } from "@/components/ui/ThemeProvider";

type EngineCardModel = {
  key: "body" | "mind" | "money" | "general";
  label: string;
  route: string;
  scorePct: number;
  planLabel: string;
  dayLabel: string;
  mainDone: number;
  mainTotal: number;
  secondaryDone: number;
  secondaryTotal: number;
  pointsDone: number;
  pointsTotal: number;
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
  titanSparkline: { dateKey: string; percent: number; label: string }[];
};

const DEFAULT_WEEK_DATA: DashboardWeekData = {
  sparklines: { body: [], mind: [], money: [], general: [] },
  comparison: [],
  taskStats: { totalCompleted: 0, bestDay: { dateKey: todayISO(), percent: 0 } },
  titanSparkline: [],
};

const DEFAULT_PLANNING: DailyPlanningModel = {
  dateKey: todayISO(),
  titan: DEFAULT_TITAN,
  summary: { completedPoints: 0, totalPoints: 0, incompleteMainCount: 0 },
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()] ?? "";
}

export default function Dashboard() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const planning = useLiveQuery(() => getDailyPlanningModel(todayKey), [todayKey]) ?? DEFAULT_PLANNING;
  const titan = planning.titan;

  const weekData =
    useLiveQuery<DashboardWeekData>(
      async () => {
        const end = todayKey;
        const start = addDaysISO(end, -6);

        const [bodySpark, mindSpark, moneySpark, generalSpark, comparison, taskStats, allEngineRange] =
          await Promise.all([
            getWeekScores("body"),
            getWeekScores("mind"),
            getWeekScores("money"),
            getWeekScores("general"),
            getWeekComparison(),
            getWeekTaskStats(),
            getDateRangeScoresForAllEngines(start, end),
          ]);

        // Compute daily Titan score for sparkline
        const dateKeys = allEngineRange.body.map((e) => e.dateKey);
        const titanSparkline = dateKeys.map((dk, i) => {
          const scores = ENGINES.map((eng) => allEngineRange[eng][i]?.score ?? EMPTY_SCORE);
          const active = scores.filter((s) => s.pointsTotal > 0);
          const pct = active.length > 0 ? Math.round(active.reduce((sum, s) => sum + s.percent, 0) / active.length) : 0;
          return { dateKey: dk, percent: pct, label: dayLabel(dk) };
        });

        return {
          sparklines: { body: bodySpark, mind: mindSpark, money: moneySpark, general: generalSpark },
          comparison,
          taskStats,
          titanSparkline,
        };
      },
      [todayKey],
    ) ?? DEFAULT_WEEK_DATA;

  const engineCards: EngineCardModel[] = React.useMemo(() => {
    const pe = titan.perEngine;
    return (["body", "mind", "money", "general"] as const).map((key) => {
      const s = pe[key];
      return {
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        route: `/os/${key}`,
        scorePct: s.percent,
        planLabel: s.pointsTotal > 0 ? `Today: ${s.percent}%` : "Plan not set",
        dayLabel: s.pointsTotal > 0 ? `${s.pointsDone}/${s.pointsTotal} pts` : "0/0 pts",
        mainDone: s.mainDone,
        mainTotal: s.mainTotal,
        secondaryDone: s.secondaryDone,
        secondaryTotal: s.secondaryTotal,
        pointsDone: s.pointsDone,
        pointsTotal: s.pointsTotal,
      };
    });
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

  const { theme } = useTheme();
  const isCyberpunk = theme === "cyberpunk";

  const thisWeekAvg = React.useMemo(() => {
    if (weekData.comparison.length === 0) return 0;
    const activeComps = weekData.comparison.filter((c) => c.thisWeekAvg > 0 || c.lastWeekAvg > 0);
    if (activeComps.length === 0) return 0;
    return Math.round(activeComps.reduce((sum, c) => sum + c.thisWeekAvg, 0) / activeComps.length);
  }, [weekData.comparison]);

  const radarHeight = isCyberpunk ? 280 : 220;

  // Preload recharts in background as soon as Dashboard mounts
  React.useEffect(() => {
    preloadRecharts();
  }, []);

  return (
    <main className="tx-dashboard w-full px-2 py-2 sm:px-4 sm:py-4">
      <TitanPageHeader
        kicker="Titan Protocol"
        title="Titan OS"
        subtitle={isCyberpunk ? `System online · ${todayKey}` : "Your performance operating system — four engines, one view."}
      />

      <section className="tx-dashboard-grid">
        <div className="tx-dashboard-top">
          {/* ── Hero: Titan Score ── */}
          <TitanPanel tone="hero" className="tx-dashboard-card tx-dashboard-hero">
            <div className="tx-score-head">
              <div>
                <p className="tx-kicker">Titan Score</p>
                {isCyberpunk ? (
                  <div className="flex items-center gap-6 mt-2">
                    <ScoreGauge value={titan.percent} size={120} label={`${titan.enginesActiveCount}/4 active`} />
                  </div>
                ) : (
                  <>
                    <p className="tx-score-main tx-display">{titan.percent.toFixed(1)}%</p>
                    <p className="tx-muted">{titan.enginesActiveCount}/4 engines active today</p>
                  </>
                )}
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

          {/* ── vs Last Week (both themes) ── */}
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

          {/* ── Radar Chart ── */}
          <TitanPanel className="tx-dashboard-card tx-dashboard-radar">
            <TitanPanelHeader kicker="Engine Overview" />
            <div className="tx-dashboard-radar-chart">
              <LazyRechartsProvider fallback={<div style={{ height: radarHeight }} className="tx-chart-skeleton" />}>
                {(rc) => (
                  <rc.ResponsiveContainer width="100%" height={radarHeight}>
                    <rc.RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <rc.PolarGrid
                        stroke={isCyberpunk ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.07)"}
                        strokeDasharray={isCyberpunk ? "2 4" : undefined}
                      />
                      <rc.PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: isCyberpunk ? "rgba(56,189,248,0.7)" : "rgba(233,240,255,0.60)",
                          fontSize: isCyberpunk ? 11 : 10,
                          letterSpacing: "0.12em",
                          fontFamily: isCyberpunk ? "var(--font-mono-cyber, monospace)" : undefined,
                        }}
                      />
                      <rc.PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <rc.Radar
                        dataKey="score"
                        stroke={isCyberpunk ? "rgba(56,189,248,0.9)" : "rgba(222,231,243,0.80)"}
                        fill={isCyberpunk ? "rgba(56,189,248,0.18)" : "rgba(222,231,243,0.15)"}
                        strokeWidth={isCyberpunk ? 2 : 1.5}
                        dot={{
                          fill: isCyberpunk ? "rgba(56,189,248,1)" : "rgba(222,231,243,0.80)",
                          r: isCyberpunk ? 4 : 2,
                          stroke: isCyberpunk ? "rgba(56,189,248,0.4)" : undefined,
                          strokeWidth: isCyberpunk ? 4 : 0,
                        }}
                        isAnimationActive={false}
                      />
                    </rc.RadarChart>
                  </rc.ResponsiveContainer>
                )}
              </LazyRechartsProvider>
            </div>
          </TitanPanel>

          {/* ── Cyberpunk-only: System Status Panel ── */}
          {isCyberpunk && (
            <TitanPanel className="tx-dashboard-card cyber-panel-sys">
              <TitanPanelHeader kicker="System Status" />
              <div className="cyber-sys-status mt-2">
                <div className="cyber-sys-row">
                  <span>Titan Score</span>
                  <div className="cyber-sys-bar">
                    <div className="cyber-sys-bar-fill" style={{ width: `${titan.percent}%` }} />
                  </div>
                  <span className="cyber-sys-val">{titan.percent.toFixed(1)}%</span>
                </div>
                {engineCards.map((c) => (
                  <div key={c.key} className="cyber-sys-row">
                    <span>{c.label}</span>
                    <div className="cyber-sys-bar">
                      <div className="cyber-sys-bar-fill" style={{ width: `${c.scorePct}%` }} />
                    </div>
                    <span className="cyber-sys-val">{c.scorePct.toFixed(0)}%</span>
                  </div>
                ))}
                <div className="cyber-sys-row" style={{ marginTop: 6, borderTop: "1px solid rgba(56,189,248,0.06)", paddingTop: 6 }}>
                  <span>Engines Active</span>
                  <span className="cyber-sys-val">{titan.enginesActiveCount}/4</span>
                </div>
                <div className="cyber-sys-row">
                  <span>Points</span>
                  <span className="cyber-sys-val">{planning.summary.completedPoints}/{planning.summary.totalPoints}</span>
                </div>
                <div className="cyber-sys-row">
                  <span>Main Open</span>
                  <span className="cyber-sys-val">{planning.summary.incompleteMainCount}</span>
                </div>
                <div className="cyber-sys-row">
                  <span>Tasks Done (7d)</span>
                  <span className="cyber-sys-val">{weekData.taskStats.totalCompleted}</span>
                </div>
              </div>
            </TitanPanel>
          )}

          {/* ── Cyberpunk-only: Weekly Pulse ── */}
          {isCyberpunk && (
            <TitanPanel className="tx-dashboard-card cyber-panel-pulse">
              <TitanPanelHeader kicker="Weekly Pulse" />
              {weekData.titanSparkline.length > 0 ? (
                <div className="mt-2">
                  <div className="cyber-pulse-grid">
                    {weekData.titanSparkline.map((d, i) => (
                      <div
                        key={d.dateKey}
                        className={`cyber-pulse-bar ${d.dateKey === todayKey ? "is-today" : ""}`}
                        style={{ height: `${Math.max(d.percent, 3)}%` }}
                        title={`${d.label}: ${d.percent}%`}
                      />
                    ))}
                  </div>
                  <div className="cyber-pulse-labels">
                    {weekData.titanSparkline.map((d) => (
                      <span key={d.dateKey} className={`cyber-pulse-label ${d.dateKey === todayKey ? "is-today" : ""}`}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="tx-muted mt-2">No data yet</p>
              )}
            </TitanPanel>
          )}
        </div>

        {/* ── Engine Cards ── */}
        <div className="tx-engine-grid">
          {engineCards.map((card) => (
            <TitanPanel key={card.key} as="article" tone="subtle" className="tx-engine-card tx-dashboard-card">
              <div className="tx-engine-top">
                <h2 className="tx-engine-title">{card.label}</h2>
                <p className="tx-engine-score tx-display">{card.scorePct.toFixed(0)}%</p>
              </div>

              {weekData.sparklines[card.key].length > 0 ? (
                <div className="tx-engine-chart">
                  <LazyRechartsProvider fallback={<div style={{ height: 40 }} />}>
                    {(rc) => (
                      <rc.ResponsiveContainer width="100%" height={40}>
                        <rc.LineChart data={weekData.sparklines[card.key]}>
                          <rc.Line
                            type="monotone"
                            dataKey="percent"
                            stroke={isCyberpunk ? "rgba(56,189,248,0.9)" : "rgba(222,231,243,0.95)"}
                            strokeWidth={1.8}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </rc.LineChart>
                      </rc.ResponsiveContainer>
                    )}
                  </LazyRechartsProvider>
                </div>
              ) : null}

              {isCyberpunk ? (
                <>
                  <div className="cyber-engine-stats">
                    <div className="cyber-engine-stat">
                      <span>Main</span>
                      <span className="cyber-engine-stat-val">{card.mainDone}/{card.mainTotal}</span>
                    </div>
                    <div className="cyber-engine-stat">
                      <span>Secondary</span>
                      <span className="cyber-engine-stat-val">{card.secondaryDone}/{card.secondaryTotal}</span>
                    </div>
                    <div className="cyber-engine-stat">
                      <span>Points</span>
                      <span className="cyber-engine-stat-val">{card.pointsDone}/{card.pointsTotal}</span>
                    </div>
                    <div className="cyber-engine-stat">
                      <span>Score</span>
                      <span className="cyber-engine-stat-val">{card.scorePct}%</span>
                    </div>
                  </div>
                  <TitanActionLink href={card.route} onClick={playClick} compact>
                    Enter
                  </TitanActionLink>
                </>
              ) : (
                <>
                  <p className="tx-engine-line">{card.planLabel}</p>
                  <p className="tx-engine-line">{card.dayLabel}</p>
                  <TitanActionLink href={card.route} onClick={playClick} compact>
                    Enter
                  </TitanActionLink>
                </>
              )}
            </TitanPanel>
          ))}
        </div>

        {/* ── Cyberpunk: Titan Score Trend (bar chart) ── */}
        {isCyberpunk && weekData.titanSparkline.length > 0 && (
          <TitanPanel className="tx-dashboard-card">
            <TitanPanelHeader kicker="7-Day Titan Score Trend" />
            <div className="mt-2" style={{ width: "100%", height: 140 }}>
              <LazyRechartsProvider fallback={<div style={{ height: 140 }} className="tx-chart-skeleton" />}>
                {(rc) => (
                  <rc.ResponsiveContainer width="100%" height="100%">
                    <rc.BarChart data={weekData.titanSparkline} barCategoryGap="20%">
                      <rc.XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(56,189,248,0.5)", fontSize: 9, fontFamily: "var(--font-mono-cyber, monospace)" }}
                        axisLine={{ stroke: "rgba(56,189,248,0.08)" }}
                        tickLine={false}
                      />
                      <rc.YAxis
                        domain={[0, 100]}
                        tick={{ fill: "rgba(56,189,248,0.3)", fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                        width={24}
                      />
                      <rc.Tooltip
                        contentStyle={{
                          background: "rgba(4,8,16,0.95)",
                          border: "1px solid rgba(56,189,248,0.2)",
                          borderRadius: 2,
                          fontSize: 10,
                          fontFamily: "var(--font-mono-cyber, monospace)",
                          color: "rgba(56,189,248,0.9)",
                        }}
                        cursor={{ fill: "rgba(56,189,248,0.04)" }}
                        formatter={(val) => [`${val}%`, "Score"]}
                      />
                      <rc.Bar
                        dataKey="percent"
                        fill="rgba(56,189,248,0.5)"
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    </rc.BarChart>
                  </rc.ResponsiveContainer>
                )}
              </LazyRechartsProvider>
            </div>
          </TitanPanel>
        )}

        {/* ── This Week Summary ── */}
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

        {/* ── Today Planner ── */}
        <TitanPanel tone="hero" className="tx-dashboard-card tx-dashboard-today">
          <div className="tx-planning-head">
            <div>
              <p className="tx-kicker">Today Planner</p>
              <h2 className="tx-planning-title">{isCyberpunk ? "Command Layer" : "Personal Command Layer"}</h2>
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
