"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type MacroRingProps = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const OUTER_COLOR = "rgba(255,255,255,0.55)";
const TRACK_COLOR = "rgba(255,255,255,0.1)";
const INNER_COLORS = ["rgba(147, 197, 253, 0.95)", "rgba(196, 181, 253, 0.95)", "rgba(251, 191, 36, 0.95)"];

export function MacroRing({ calories, protein_g, carbs_g, fat_g }: MacroRingProps) {
  const safeCalories = Math.max(0, Math.round(calories));
  const macroCalories = [
    Math.max(0, Math.round(protein_g * 4)),
    Math.max(0, Math.round(carbs_g * 4)),
    Math.max(0, Math.round(fat_g * 9)),
  ];
  const hasMacros = macroCalories.some((value) => value > 0);

  const outerData = safeCalories > 0 ? [{ name: "calories", value: safeCalories }] : [{ name: "empty", value: 1 }];
  const innerData = hasMacros
    ? [
        { name: "Protein", value: macroCalories[0] },
        { name: "Carbs", value: macroCalories[1] },
        { name: "Fat", value: macroCalories[2] },
      ]
    : [{ name: "empty", value: 1 }];

  return (
    <div className="relative h-64 w-64 max-w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={[{ value: 1 }]} dataKey="value" outerRadius={104} innerRadius={92} fill={TRACK_COLOR} stroke="none" />
          <Pie
            data={outerData}
            dataKey="value"
            outerRadius={104}
            innerRadius={92}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            fill={OUTER_COLOR}
            isAnimationActive
            animationDuration={500}
          />
          <Pie
            data={innerData}
            dataKey="value"
            outerRadius={78}
            innerRadius={70}
            startAngle={90}
            endAngle={-270}
            paddingAngle={hasMacros ? 2 : 0}
            stroke="none"
            isAnimationActive
            animationDuration={500}
          >
            {innerData.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={hasMacros ? INNER_COLORS[index % INNER_COLORS.length] : TRACK_COLOR}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Total Calories</p>
        <p className="mt-1 text-2xl font-semibold text-white">{safeCalories}</p>
        <p className="mt-2 text-xs text-white/70">
          P {Math.max(0, Math.round(protein_g))} • C {Math.max(0, Math.round(carbs_g))} • F {Math.max(0, Math.round(fat_g))}
        </p>
      </div>
    </div>
  );
}
