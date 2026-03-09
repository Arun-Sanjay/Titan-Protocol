import { db } from "./db";
import type { GymExercise, GymTemplate, GymTemplateExercise, GymSession, GymSet } from "./db";

// ─── Exercise Library ────────────────────────────────────────────────────────

export async function listExercises(): Promise<GymExercise[]> {
  return db.gym_exercises.toArray();
}

export async function addExercise(
  name: string,
  muscleGroup: string,
  equipment: string,
): Promise<number> {
  return db.gym_exercises.add({
    name,
    muscleGroup,
    equipment,
    createdAt: Date.now(),
  });
}

export async function deleteExercise(exerciseId: number): Promise<void> {
  await db.gym_exercises.delete(exerciseId);
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<GymTemplate[]> {
  return db.gym_templates.toArray();
}

export async function addTemplate(name: string): Promise<number> {
  return db.gym_templates.add({
    name,
    createdAt: Date.now(),
  });
}

export async function addTemplateExercise(
  templateId: number,
  exerciseId: number,
  order: number,
): Promise<number> {
  return db.gym_template_exercises.add({
    templateId,
    exerciseId,
    order,
  });
}

export async function removeTemplateExercise(id: number): Promise<void> {
  await db.gym_template_exercises.delete(id);
}

export async function getTemplateExercises(
  templateId: number,
): Promise<GymTemplateExercise[]> {
  return db.gym_template_exercises
    .where("templateId")
    .equals(templateId)
    .sortBy("order");
}

export async function reorderTemplateExercises(
  templateId: number,
  orderedIds: number[],
): Promise<void> {
  await db.transaction("rw", db.gym_template_exercises, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.gym_template_exercises.update(orderedIds[i], { order: i });
    }
  });
}

export async function deleteTemplate(templateId: number): Promise<void> {
  await db.transaction(
    "rw",
    db.gym_templates,
    db.gym_template_exercises,
    async () => {
      await db.gym_template_exercises
        .where("templateId")
        .equals(templateId)
        .delete();
      await db.gym_templates.delete(templateId);
    },
  );
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function startSession(
  templateId: number,
  dateKey: string,
): Promise<number> {
  return db.gym_sessions.add({
    dateKey,
    templateId,
    startedAt: Date.now(),
    endedAt: null,
  });
}

export async function endSession(sessionId: number): Promise<void> {
  await db.gym_sessions.update(sessionId, { endedAt: Date.now() });
}

export async function getActiveSession(): Promise<GymSession | undefined> {
  return db.gym_sessions.filter((s) => s.endedAt === null).first();
}

export async function listSessionsByDate(
  dateKey: string,
): Promise<GymSession[]> {
  return db.gym_sessions.where("dateKey").equals(dateKey).toArray();
}

export async function listSessionHistory(limit: number): Promise<GymSession[]> {
  return db.gym_sessions.orderBy("id").reverse().limit(limit).toArray();
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction("rw", db.gym_sessions, db.gym_sets, async () => {
    await db.gym_sets.where("sessionId").equals(sessionId).delete();
    await db.gym_sessions.delete(sessionId);
  });
}

// ─── Sets ────────────────────────────────────────────────────────────────────

export async function addSet(
  sessionId: number,
  exerciseId: number,
  setIndex: number,
  weight: number,
  reps: number,
): Promise<number> {
  return db.gym_sets.add({
    sessionId,
    exerciseId,
    setIndex,
    weight,
    reps,
  });
}

export async function updateSet(
  setId: number,
  patch: Partial<Pick<GymSet, "weight" | "reps">>,
): Promise<void> {
  await db.gym_sets.update(setId, patch);
}

export async function deleteSet(setId: number): Promise<void> {
  await db.gym_sets.delete(setId);
}

export async function getSetsForSession(sessionId: number): Promise<GymSet[]> {
  return db.gym_sets.where("sessionId").equals(sessionId).toArray();
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

const SEED_EXERCISES: Array<{ name: string; muscleGroup: string; equipment: string }> = [
  // Chest
  { name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Incline Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Decline Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { name: "Dumbbell Press", muscleGroup: "Chest", equipment: "Dumbbell" },
  { name: "Dumbbell Incline Press", muscleGroup: "Chest", equipment: "Dumbbell" },
  { name: "Cable Fly", muscleGroup: "Chest", equipment: "Cable" },
  { name: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine" },
  { name: "Pushups", muscleGroup: "Chest", equipment: "Bodyweight" },
  { name: "Dumbbell Fly", muscleGroup: "Chest", equipment: "Dumbbell" },
  { name: "Pec Deck", muscleGroup: "Chest", equipment: "Machine" },

  // Back
  { name: "Pull Ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { name: "Barbell Row", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Seated Cable Row", muscleGroup: "Back", equipment: "Cable" },
  { name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Face Pull", muscleGroup: "Back", equipment: "Cable" },
  { name: "T-Bar Row", muscleGroup: "Back", equipment: "Barbell" },
  { name: "Single Arm Dumbbell Row", muscleGroup: "Back", equipment: "Dumbbell" },
  { name: "Chin Ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { name: "Straight Arm Pulldown", muscleGroup: "Back", equipment: "Cable" },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Lateral Raise", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Front Raise", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Reverse Fly", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Arnold Press", muscleGroup: "Shoulders", equipment: "Dumbbell" },
  { name: "Cable Lateral Raise", muscleGroup: "Shoulders", equipment: "Cable" },
  { name: "Upright Row", muscleGroup: "Shoulders", equipment: "Barbell" },
  { name: "Rear Delt Fly Machine", muscleGroup: "Shoulders", equipment: "Machine" },
  { name: "Shrugs", muscleGroup: "Shoulders", equipment: "Dumbbell" },

  // Arms
  { name: "Barbell Curl", muscleGroup: "Arms", equipment: "Barbell" },
  { name: "Dumbbell Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Hammer Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Tricep Pushdown", muscleGroup: "Arms", equipment: "Cable" },
  { name: "Skullcrusher", muscleGroup: "Arms", equipment: "Barbell" },
  { name: "Dips", muscleGroup: "Arms", equipment: "Bodyweight" },
  { name: "Preacher Curl", muscleGroup: "Arms", equipment: "Barbell" },
  { name: "Concentration Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  { name: "Overhead Tricep Extension", muscleGroup: "Arms", equipment: "Cable" },
  { name: "Close Grip Bench Press", muscleGroup: "Arms", equipment: "Barbell" },

  // Legs
  { name: "Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Front Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Leg Curl", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Leg Extension", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Romanian Deadlift", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Lunges", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Hip Thrust", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Calf Raise", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Bulgarian Split Squat", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Hack Squat", muscleGroup: "Legs", equipment: "Machine" },
  { name: "Goblet Squat", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Sumo Deadlift", muscleGroup: "Legs", equipment: "Barbell" },
  { name: "Step Ups", muscleGroup: "Legs", equipment: "Dumbbell" },
  { name: "Glute Kickback", muscleGroup: "Legs", equipment: "Cable" },

  // Core
  { name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Hanging Leg Raise", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Cable Crunch", muscleGroup: "Core", equipment: "Cable" },
  { name: "Russian Twist", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Ab Rollout", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Bicycle Crunch", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Weighted Decline Sit Up", muscleGroup: "Core", equipment: "Dumbbell" },
  { name: "Pallof Press", muscleGroup: "Core", equipment: "Cable" },
  { name: "Dead Bug", muscleGroup: "Core", equipment: "Bodyweight" },
  { name: "Mountain Climbers", muscleGroup: "Core", equipment: "Bodyweight" },
];

const SEED_TEMPLATES: Array<{ name: string; exercises: string[] }> = [
  {
    name: "Push Day",
    exercises: [
      "Bench Press",
      "Incline Bench Press",
      "Overhead Press",
      "Lateral Raise",
      "Tricep Pushdown",
      "Dips",
    ],
  },
  {
    name: "Pull Day",
    exercises: [
      "Pull Ups",
      "Barbell Row",
      "Seated Cable Row",
      "Face Pull",
      "Barbell Curl",
      "Hammer Curl",
    ],
  },
  {
    name: "Leg Day",
    exercises: [
      "Squat",
      "Romanian Deadlift",
      "Leg Press",
      "Leg Curl",
      "Leg Extension",
      "Calf Raise",
    ],
  },
  {
    name: "Upper Body",
    exercises: [
      "Bench Press",
      "Barbell Row",
      "Overhead Press",
      "Lat Pulldown",
      "Barbell Curl",
      "Tricep Pushdown",
    ],
  },
  {
    name: "Lower Body",
    exercises: [
      "Squat",
      "Romanian Deadlift",
      "Hip Thrust",
      "Leg Press",
      "Lunges",
      "Calf Raise",
    ],
  },
  {
    name: "Push Pull Legs",
    exercises: [
      "Bench Press",
      "Overhead Press",
      "Pull Ups",
      "Barbell Row",
      "Squat",
      "Romanian Deadlift",
    ],
  },
  {
    name: "Chest + Triceps",
    exercises: [
      "Bench Press",
      "Incline Bench Press",
      "Cable Fly",
      "Dumbbell Press",
      "Tricep Pushdown",
      "Skullcrusher",
    ],
  },
  {
    name: "Back + Biceps",
    exercises: [
      "Pull Ups",
      "Barbell Row",
      "Seated Cable Row",
      "Lat Pulldown",
      "Barbell Curl",
      "Hammer Curl",
    ],
  },
  {
    name: "Full Body",
    exercises: [
      "Squat",
      "Bench Press",
      "Barbell Row",
      "Overhead Press",
      "Romanian Deadlift",
      "Pull Ups",
    ],
  },
  {
    name: "Beginner Full Body",
    exercises: [
      "Goblet Squat",
      "Dumbbell Press",
      "Single Arm Dumbbell Row",
      "Dumbbell Shoulder Press",
      "Lunges",
      "Plank",
    ],
  },
];

export async function seedExerciseDatabase(): Promise<void> {
  const count = await db.gym_exercises.count();
  if (count > 0) return;

  const now = Date.now();
  const exercises = SEED_EXERCISES.map((e) => ({
    ...e,
    createdAt: now,
  }));
  await db.gym_exercises.bulkAdd(exercises);
}

export async function seedTemplates(): Promise<void> {
  const count = await db.gym_templates.count();
  if (count > 0) return;

  // Ensure exercises exist first
  await seedExerciseDatabase();

  const allExercises = await db.gym_exercises.toArray();
  const exerciseByName = new Map<string, number>();
  for (const ex of allExercises) {
    if (ex.id !== undefined) {
      exerciseByName.set(ex.name, ex.id);
    }
  }

  for (const tpl of SEED_TEMPLATES) {
    const templateId = await db.gym_templates.add({
      name: tpl.name,
      createdAt: Date.now(),
    });

    const templateExercises: Array<{
      templateId: number;
      exerciseId: number;
      order: number;
    }> = [];

    for (let i = 0; i < tpl.exercises.length; i++) {
      const exerciseId = exerciseByName.get(tpl.exercises[i]);
      if (exerciseId !== undefined) {
        templateExercises.push({
          templateId,
          exerciseId,
          order: i,
        });
      }
    }

    if (templateExercises.length > 0) {
      await db.gym_template_exercises.bulkAdd(templateExercises);
    }
  }
}
