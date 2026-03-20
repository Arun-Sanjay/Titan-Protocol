"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { todayISO } from "../../../lib/date";
import { getDailyPlanningModel } from "../../../lib/dashboard-stats";

export function CyberTicker() {
  const todayKey = React.useMemo(() => todayISO(), []);
  const planning = useLiveQuery(() => getDailyPlanningModel(todayKey), [todayKey]);

  const titanPct = planning?.titan.percent.toFixed(1) ?? "0.0";
  const enginesActive = planning?.titan.enginesActiveCount ?? 0;
  const mainOpen = planning?.summary.incompleteMainCount ?? 0;

  return (
    <div className="cyber-ticker">
      <span>SYS.TITAN</span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>SCORE: <span className="cyber-ticker-val">{titanPct}%</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>ENGINES: <span className="cyber-ticker-val">{enginesActive}/4</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>MAIN.OPEN: <span className="cyber-ticker-val">{mainOpen}</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>DATE: <span className="cyber-ticker-val">{todayKey}</span></span>
      <span className="cyber-ticker-sep">{"//"}</span>
      <span>STATUS: <span className="cyber-ticker-val">OPERATIONAL</span></span>
      <span className="cyber-ticker-cursor">_</span>
    </div>
  );
}
