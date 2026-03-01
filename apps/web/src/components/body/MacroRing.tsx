import * as React from "react";

type MacroRingProps = {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  goalCalories?: number | null;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function MacroRing({ calories, protein, carbs, fat, goalCalories }: MacroRingProps) {
  const hasGoal = typeof goalCalories === "number" && goalCalories > 0;
  const progress = hasGoal ? clamp((calories / goalCalories) * 100) : 72;

  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(rgba(226,236,255,0.85) ${progress}%, rgba(255,255,255,0.1) ${progress}% 100%)`,
  };

  return (
    <div className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-4">
      <div className="relative grid h-48 w-48 place-items-center rounded-full" style={ringStyle}>
        <div className="absolute inset-[11px] rounded-full bg-[rgba(5,8,16,0.92)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" />
        <div className="absolute inset-[24px] rounded-full border border-white/10" />
        <div className="relative text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Calories</p>
          <p className="mt-1 text-3xl font-semibold text-white">{calories}</p>
          {hasGoal ? <p className="mt-1 text-xs text-white/60">Goal {goalCalories}</p> : null}
        </div>
      </div>

      <div className="grid w-full grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-white/12 bg-white/[0.03] p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">P</p>
          <p className="mt-1 text-sm font-medium text-white">{protein ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-white/12 bg-white/[0.03] p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">C</p>
          <p className="mt-1 text-sm font-medium text-white">{carbs ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-white/12 bg-white/[0.03] p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">F</p>
          <p className="mt-1 text-sm font-medium text-white">{fat ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
