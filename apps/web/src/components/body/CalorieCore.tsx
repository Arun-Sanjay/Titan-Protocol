"use client";

import * as React from "react";

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function CalorieCore({
  calories,
  goalCalories,
  protein,
  carbs,
  fat,
}: {
  calories: number;
  goalCalories?: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}) {
  const hasGoal = typeof goalCalories === "number" && goalCalories > 0;
  const pct = hasGoal ? clamp((calories / (goalCalories as number)) * 100) : 0;
  const ringStyle = hasGoal
    ? {
        background: `conic-gradient(rgba(223, 236, 255, 0.92) ${pct}%, rgba(255,255,255,0.12) ${pct}% 100%)`,
      }
    : {
        background:
          "conic-gradient(rgba(223, 236, 255, 0.28), rgba(255,255,255,0.08), rgba(223, 236, 255, 0.28))",
      };

  const macroText = {
    protein: protein === null ? "—" : `${protein}g`,
    carbs: carbs === null ? "—" : `${carbs}g`,
    fat: fat === null ? "—" : `${fat}g`,
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-56 w-56">
        <div className="absolute inset-0 rounded-full p-[10px]" style={ringStyle}>
          <div className="chrome-panel flex h-full w-full flex-col items-center justify-center rounded-full text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-white/65">Total Calories</p>
            <p className="mt-1 text-4xl font-semibold text-white">{calories}</p>
            {hasGoal ? (
              <p className="mt-1 text-xs text-white/60">
                Goal {goalCalories} • {pct.toFixed(0)}%
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/50">No calorie goal</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2 text-center text-sm">
        <div className="chrome-outline rounded-lg bg-white/[0.03] px-2 py-2 text-white/85">
          <p className="text-xs uppercase tracking-[0.12em] text-white/55">Protein</p>
          <p className="mt-1 font-semibold text-white">{macroText.protein}</p>
        </div>
        <div className="chrome-outline rounded-lg bg-white/[0.03] px-2 py-2 text-white/85">
          <p className="text-xs uppercase tracking-[0.12em] text-white/55">Carbs</p>
          <p className="mt-1 font-semibold text-white">{macroText.carbs}</p>
        </div>
        <div className="chrome-outline rounded-lg bg-white/[0.03] px-2 py-2 text-white/85">
          <p className="text-xs uppercase tracking-[0.12em] text-white/55">Fat</p>
          <p className="mt-1 font-semibold text-white">{macroText.fat}</p>
        </div>
      </div>
    </div>
  );
}
