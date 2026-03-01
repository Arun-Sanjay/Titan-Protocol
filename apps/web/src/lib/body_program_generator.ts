import type {
  BodyProfileRecord,
  BodyProgramGoalType,
  ProgramTaskCategory,
  ProgramTaskFrequencyType,
} from "./db";

export type BodyIntakeAnswers = {
  body_fat_pct: number | null;
  goal_type: BodyProgramGoalType;
  target_weight_kg: number | null;
  target_body_fat_pct: number | null;
  training_type: "gym" | "boxing" | "hybrid";
  training_days_per_week: number;
  sleep_hours_avg: number;
  daily_steps_avg: number;
  duration_days: number;
};

export type GeneratedBodyTask = {
  title: string;
  category: ProgramTaskCategory;
  is_locked: boolean;
  is_active: boolean;
  frequency_type: ProgramTaskFrequencyType;
  target_value: number | null;
  unit: string | null;
  description: string;
  module: "nutrition" | "gym" | "boxing" | "recovery" | "sleep" | "general";
  frequency: "daily" | "weekly";
  target: string | null;
};

export type GeneratedBodyTasks = {
  targets: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    steps: number;
    sleep_hours: number;
  };
  tasks: GeneratedBodyTask[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function parseTarget(task: {
  title: string;
  category: ProgramTaskCategory;
  is_locked: boolean;
  frequency_type: ProgramTaskFrequencyType;
  target_value: number | null;
  unit: string | null;
  description: string;
}): GeneratedBodyTask {
  const module =
    task.category === "nutrition"
      ? "nutrition"
      : task.category === "sleep"
        ? "sleep"
        : task.category === "recovery"
          ? "recovery"
          : "general";

  return {
    ...task,
    is_active: true,
    module,
    frequency: task.frequency_type,
    target:
      task.target_value === null ? null : task.unit ? `${task.target_value} ${task.unit}` : String(task.target_value),
  };
}

export function generateBodyTasks(profile: BodyProfileRecord, answers: BodyIntakeAnswers): GeneratedBodyTasks {
  const weight = clamp(profile.weight_kg, 30, 260);
  const sleepTarget = 8;
  const hydrationLiters = 3;
  const trainingDays = clamp(answers.training_days_per_week, 1, 7);

  let calorieTarget = round(weight * 30);
  let proteinTarget = round(weight * 1.8);
  let fatTarget = round(weight * 0.8);
  let carbTarget = 0;
  let stepTarget = 7000;

  const tasks: GeneratedBodyTask[] = [];

  if (answers.goal_type === "cut") {
    calorieTarget = round(weight * 23);
    proteinTarget = round(weight * 2.0);
    fatTarget = round(weight * 0.7);
    stepTarget = Math.max(8000, round(answers.daily_steps_avg || 8000));

    tasks.push(
      parseTarget({
        title: "Hit Calorie Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: calorieTarget,
        unit: "kcal",
        description: "Maintain daily deficit target for fat-loss cycle.",
      }),
      parseTarget({
        title: "Hit Protein Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: proteinTarget,
        unit: "g",
        description: "Protect lean mass while cutting.",
      }),
      parseTarget({
        title: "Daily Steps",
        category: "general",
        is_locked: true,
        frequency_type: "daily",
        target_value: stepTarget,
        unit: "steps",
        description: "Keep NEAT high during cut.",
      }),
    );
  } else if (answers.goal_type === "bulk") {
    calorieTarget = round(weight * 34);
    proteinTarget = round(weight * 1.8);
    fatTarget = round(weight * 0.9);
    stepTarget = Math.max(6000, round(answers.daily_steps_avg || 6000));

    tasks.push(
      parseTarget({
        title: "Hit Calorie Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: calorieTarget,
        unit: "kcal",
        description: "Maintain lean surplus for growth.",
      }),
      parseTarget({
        title: "Hit Protein Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: proteinTarget,
        unit: "g",
        description: "Support muscle gain.",
      }),
      parseTarget({
        title: "Progressive Overload Session",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: trainingDays,
        unit: "sessions",
        description: "Increase load/reps each week.",
      }),
      parseTarget({
        title: "Recovery Day",
        category: "recovery",
        is_locked: false,
        frequency_type: "weekly",
        target_value: 1,
        unit: "day",
        description: "Structured recovery day each week.",
      }),
    );
  } else if (answers.goal_type === "performance") {
    calorieTarget = round(weight * 30);
    proteinTarget = round(weight * 1.8);
    fatTarget = round(weight * 0.8);
    stepTarget = Math.max(7000, round(answers.daily_steps_avg || 7000));

    tasks.push(
      parseTarget({
        title: "Hit Calorie Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: calorieTarget,
        unit: "kcal",
        description: "Maintain fuel around maintenance.",
      }),
      parseTarget({
        title: "Hit Protein Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: proteinTarget,
        unit: "g",
        description: "Support adaptation and recovery.",
      }),
      parseTarget({
        title: "Conditioning Sessions",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: trainingDays,
        unit: "sessions",
        description: "Hit weekly conditioning volume.",
      }),
      parseTarget({
        title: "Skill Sessions",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: Math.max(2, trainingDays - 1),
        unit: "sessions",
        description: "Dedicated technical practice.",
      }),
      parseTarget({
        title: "Mobility Sessions",
        category: "recovery",
        is_locked: false,
        frequency_type: "weekly",
        target_value: 3,
        unit: "sessions",
        description: "Minimum weekly mobility work.",
      }),
    );
  } else {
    calorieTarget = round(weight * 27);
    proteinTarget = round(weight * 2.0);
    fatTarget = round(weight * 0.8);
    stepTarget = Math.max(7500, round(answers.daily_steps_avg || 7500));

    tasks.push(
      parseTarget({
        title: "Hit Calorie Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: calorieTarget,
        unit: "kcal",
        description: "Hold intake close to recomp target.",
      }),
      parseTarget({
        title: "Hit Protein Target",
        category: "nutrition",
        is_locked: true,
        frequency_type: "daily",
        target_value: proteinTarget,
        unit: "g",
        description: "High protein baseline for recomp.",
      }),
      parseTarget({
        title: "Training Sessions",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: trainingDays,
        unit: "sessions",
        description: "Hit planned sessions this week.",
      }),
    );
  }

  tasks.push(
    parseTarget({
      title: "Sleep Target",
      category: "sleep",
      is_locked: true,
      frequency_type: "daily",
      target_value: sleepTarget,
      unit: "hours",
      description: "Minimum nightly sleep target.",
    }),
    parseTarget({
      title: "Hydration",
      category: "recovery",
      is_locked: true,
      frequency_type: "daily",
      target_value: hydrationLiters,
      unit: "L",
      description: "Minimum hydration baseline.",
    }),
  );

  if (answers.training_type === "gym") {
    tasks.push(
      parseTarget({
        title: "Gym Sessions",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: trainingDays,
        unit: "sessions",
        description: "Complete planned gym sessions.",
      }),
    );
  } else if (answers.training_type === "boxing") {
    tasks.push(
      parseTarget({
        title: "Boxing Sessions",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: trainingDays,
        unit: "sessions",
        description: "Complete planned boxing sessions.",
      }),
    );
  } else {
    tasks.push(
      parseTarget({
        title: "Hybrid Sessions",
        category: "training",
        is_locked: false,
        frequency_type: "weekly",
        target_value: trainingDays,
        unit: "sessions",
        description: "Complete combined gym/boxing sessions.",
      }),
    );
  }

  carbTarget = Math.max(0, round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4));

  return {
    targets: {
      calories: calorieTarget,
      protein_g: proteinTarget,
      fat_g: fatTarget,
      carbs_g: carbTarget,
      steps: stepTarget,
      sleep_hours: sleepTarget,
    },
    tasks,
  };
}
