import type { BodyTask } from "./db";

export type BodyDayScore = {
  mainTotal: number;
  mainDone: number;
  secondaryTotal: number;
  secondaryDone: number;
  pointsTotal: number;
  pointsDone: number;
  percent: number;
};

export function computeBodyDayScore(tasks: Array<BodyTask & { completed: boolean }>): BodyDayScore {
  const mainTotal = tasks.filter((task) => task.priority === "main").length;
  const mainDone = tasks.filter((task) => task.priority === "main" && task.completed).length;
  const secondaryTotal = tasks.filter((task) => task.priority === "secondary").length;
  const secondaryDone = tasks.filter((task) => task.priority === "secondary" && task.completed).length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);

  return {
    mainTotal,
    mainDone,
    secondaryTotal,
    secondaryDone,
    pointsTotal,
    pointsDone,
    percent,
  };
}
