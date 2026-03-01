import {
  type BodyMealRecord,
  db,
  type ExerciseRecord,
  type TemplateExerciseRecord,
  type WorkoutExerciseRecord,
  type WorkoutRecord,
  type WorkoutTemplateRecord,
  type WorkoutSetRecord,
} from "./db";
import { autoEvaluateGymTasks } from "./body_logs";
import { getActiveBodyProgram } from "./body_program";
import { getEngineByName, getModuleByName, getPrimaryCycle, syncEngineModules } from "./engine";

export type WorkoutDetail = {
  workout: WorkoutRecord;
  exercises: Array<{
    exercise: WorkoutExerciseRecord;
    sets: WorkoutSetRecord[];
  }>;
};

let exerciseCatalogSyncPromise: Promise<void> | null = null;

function normalizeExerciseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function findExerciseByName(name: string): Promise<ExerciseRecord | undefined> {
  const normalized = normalizeExerciseName(name).toLowerCase();
  const allExercises = await db.exercises.toArray();
  return allExercises.find((exercise) => exercise.name.toLowerCase() === normalized);
}

export async function ensureExerciseCatalogSync(): Promise<void> {
  if (!exerciseCatalogSyncPromise) {
    exerciseCatalogSyncPromise = (async () => {
      const workoutExercises = await db.workout_exercises.toArray();
      for (const workoutExercise of workoutExercises) {
        if (workoutExercise.exercise_id) continue;
        const exercise = await upsertExercise(workoutExercise.name);
        await db.workout_exercises.update(workoutExercise.id as number, {
          exercise_id: exercise.id as number,
          name: exercise.name,
        });
      }
    })().finally(() => {
      exerciseCatalogSyncPromise = null;
    });
  }

  await exerciseCatalogSyncPromise;
}

export async function upsertExercise(name: string, muscle_group?: string): Promise<ExerciseRecord> {
  const normalized = normalizeExerciseName(name);
  if (!normalized) throw new Error("Exercise name is required");

  const existing = await findExerciseByName(normalized);
  if (existing?.id) {
    if (muscle_group && existing.muscle_group !== muscle_group) {
      await db.exercises.update(existing.id, { muscle_group });
      const updated = await db.exercises.get(existing.id);
      if (!updated) throw new Error("Failed to update exercise");
      return updated;
    }
    return existing;
  }

  const id = await db.exercises.add({
    name: normalized,
    muscle_group,
    created_at: Date.now(),
  });
  const created = await db.exercises.get(id);
  if (!created) throw new Error("Failed to create exercise");
  return created;
}

export async function listExercises(query?: string): Promise<ExerciseRecord[]> {
  await ensureExerciseCatalogSync();
  const exercises = await db.exercises.toArray();
  const normalized = query?.trim().toLowerCase();
  return exercises
    .filter((exercise) => !normalized || exercise.name.toLowerCase().includes(normalized))
    .sort((first, second) => first.name.localeCompare(second.name));
}

export async function createTemplate(
  title: string,
  exerciseIdsInOrder: number[],
): Promise<WorkoutTemplateRecord> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Template title is required");

  return db.transaction("rw", db.workout_templates, db.template_exercises, async () => {
    const templateId = await db.workout_templates.add({
      title: normalizedTitle,
      created_at: Date.now(),
    });

    if (exerciseIdsInOrder.length > 0) {
      await db.template_exercises.bulkAdd(
        exerciseIdsInOrder.map((exercise_id, index) => ({
          template_id: templateId,
          exercise_id,
          order: index + 1,
        })),
      );
    }

    const template = await db.workout_templates.get(templateId);
    if (!template) throw new Error("Failed to create template");
    return template;
  });
}

export async function listTemplates(): Promise<WorkoutTemplateRecord[]> {
  return db.workout_templates.orderBy("created_at").reverse().toArray();
}

export async function getTemplate(template_id: number): Promise<
  | {
      template: WorkoutTemplateRecord;
      exercises: Array<{ templateExercise: TemplateExerciseRecord; exercise: ExerciseRecord | undefined }>;
    }
  | undefined
> {
  const template = await db.workout_templates.get(template_id);
  if (!template) return undefined;
  const templateExercises = await db.template_exercises.where("template_id").equals(template_id).toArray();
  const exercises = await db.exercises.toArray();

  return {
    template,
    exercises: templateExercises
      .sort((first, second) => first.order - second.order)
      .map((templateExercise) => ({
        templateExercise,
        exercise: exercises.find((exercise) => exercise.id === templateExercise.exercise_id),
      })),
  };
}

export async function startEmptyWorkout(title: string, date: string): Promise<WorkoutRecord> {
  const engine = await getEngineByName("body");
  if (!engine?.id) throw new Error("Body engine not found");
  await syncEngineModules(engine.id, engine.name);
  const gymModule = await getModuleByName(engine.id, "Gym Tracker");
  const primaryCycle = await getPrimaryCycle(engine.id, gymModule?.id);

  const id = await db.workouts.add({
    engine_id: engine.id,
    cycle_id: primaryCycle?.id ?? null,
    date,
    title: title.trim() || "Workout",
    finished_at: null,
  });
  const workout = await db.workouts.get(id);
  if (!workout) throw new Error("Failed to create workout");
  return workout;
}

export async function startWorkoutFromTemplate(template_id: number, date: string): Promise<WorkoutRecord> {
  await ensureExerciseCatalogSync();
  const template = await getTemplate(template_id);
  if (!template) throw new Error("Template not found");

  return db.transaction("rw", db.workouts, db.workout_exercises, async () => {
    const workout = await startEmptyWorkout(template.template.title, date);
    await db.workout_exercises.bulkAdd(
      template.exercises.map(({ exercise }, index) => ({
        workout_id: workout.id as number,
        exercise_id: exercise?.id ?? null,
        name: exercise?.name ?? "Exercise",
        order: index + 1,
      })),
    );
    const created = await db.workouts.get(workout.id as number);
    if (!created) throw new Error("Failed to start workout from template");
    return created;
  });
}

export async function addExerciseToWorkout(
  workout_id: number,
  exercise: number | string,
): Promise<WorkoutExerciseRecord> {
  await ensureExerciseCatalogSync();
  const existing = await db.workout_exercises.where("workout_id").equals(workout_id).toArray();
  const order = existing.length + 1;

  let exerciseRecord: ExerciseRecord | undefined;
  if (typeof exercise === "number") {
    exerciseRecord = await db.exercises.get(exercise);
    if (!exerciseRecord) throw new Error("Exercise not found");
  } else {
    exerciseRecord = await upsertExercise(exercise);
  }

  const id = await db.workout_exercises.add({
    workout_id,
    exercise_id: exerciseRecord.id ?? null,
    name: exerciseRecord.name,
    order,
  });
  const created = await db.workout_exercises.get(id);
  if (!created) throw new Error("Failed to add exercise to workout");
  return created;
}

export async function createSetWithDefaults(workout_exercise_id: number): Promise<WorkoutSetRecord> {
  const existing = await db.workout_sets
    .where("workout_exercise_id")
    .equals(workout_exercise_id)
    .sortBy("set_index");

  const previous = existing[existing.length - 1];
  const setIndex = (previous?.set_index ?? 0) + 1;

  const id = await db.workout_sets.add({
    workout_exercise_id,
    set_index: setIndex,
    reps: previous?.reps ?? 8,
    weight: previous?.weight ?? 0,
    notes: previous?.notes ?? "",
    done: false,
  });
  const set = await db.workout_sets.get(id);
  if (!set) throw new Error("Failed to add set");
  return set;
}

export async function updateWorkoutSet(
  set_id: number,
  changes: Partial<Pick<WorkoutSetRecord, "reps" | "weight" | "notes" | "done">>,
): Promise<WorkoutSetRecord> {
  await db.workout_sets.update(set_id, changes);
  const updated = await db.workout_sets.get(set_id);
  if (!updated) throw new Error("Workout set not found");
  return updated;
}

export async function finishWorkout(workout_id: number): Promise<WorkoutRecord> {
  const finishedAt = Date.now();
  await db.workouts.update(workout_id, { finished_at: finishedAt });
  const updated = await db.workouts.get(workout_id);
  if (!updated) throw new Error("Workout not found");

  try {
    const activeProgram = await getActiveBodyProgram();
    const activeProgramId = activeProgram?.program.id;
    if (activeProgramId) {
      const date = updated.date;
      await autoEvaluateGymTasks(activeProgramId, date);
    }
  } catch {}

  return updated;
}

export async function reorderWorkoutExercises(
  workout_id: number,
  orderedWorkoutExerciseIds: number[],
): Promise<void> {
  const current = await db.workout_exercises.where("workout_id").equals(workout_id).toArray();
  const validIds = new Set(current.map((item) => item.id as number));
  if (!orderedWorkoutExerciseIds.every((id) => validIds.has(id))) {
    throw new Error("Invalid workout exercise order");
  }

  await db.workout_exercises.bulkUpdate(
    orderedWorkoutExerciseIds.map((id, index) => ({
      key: id,
      changes: { order: index + 1 },
    })),
  );
}

export async function getWorkouts(limit = 10): Promise<WorkoutRecord[]> {
  const engine = await getEngineByName("body");
  if (!engine?.id) return [];
  const workouts = await db.workouts.where("engine_id").equals(engine.id).toArray();
  return workouts
    .sort((first, second) => {
      if (first.date === second.date) return (second.id ?? 0) - (first.id ?? 0);
      return second.date.localeCompare(first.date);
    })
    .slice(0, limit);
}

export async function getWorkout(workout_id: number): Promise<WorkoutRecord | undefined> {
  return db.workouts.get(workout_id);
}

export async function getWorkoutDetail(workout_id: number): Promise<WorkoutDetail | undefined> {
  const workout = await db.workouts.get(workout_id);
  if (!workout) return undefined;

  const exercises = await db.workout_exercises.where("workout_id").equals(workout_id).toArray();
  const sets = await db.workout_sets.toArray();

  return {
    workout,
    exercises: exercises
      .sort((first, second) => first.order - second.order)
      .map((exercise) => ({
        exercise,
        sets: sets
          .filter((set) => set.workout_exercise_id === exercise.id)
          .sort((first, second) => first.set_index - second.set_index),
      })),
  };
}

function normalizeMacro(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.max(0, Math.round(Number(value)));
}

export async function addMeal(input: {
  date: string;
  name: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): Promise<BodyMealRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Meal name is required");
  const calories = Number(input.calories);
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error("Calories are required");
  }

  const id = await db.body_meals.add({
    date: input.date,
    name,
    calories: Math.round(calories),
    protein: normalizeMacro(input.protein),
    carbs: normalizeMacro(input.carbs),
    fat: normalizeMacro(input.fat),
    created_at: Date.now(),
  });
  const created = await db.body_meals.get(id);
  if (!created) throw new Error("Failed to create meal");
  return created;
}

export async function updateMeal(
  id: number,
  input: {
    name: string;
    calories: number;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
  },
): Promise<BodyMealRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Meal name is required");
  const calories = Number(input.calories);
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error("Calories are required");
  }

  await db.body_meals.update(id, {
    name,
    calories: Math.round(calories),
    protein: normalizeMacro(input.protein),
    carbs: normalizeMacro(input.carbs),
    fat: normalizeMacro(input.fat),
  });
  const updated = await db.body_meals.get(id);
  if (!updated) throw new Error("Meal not found");
  return updated;
}

export async function deleteMeal(id: number): Promise<void> {
  await db.body_meals.delete(id);
}

export async function listMealsByDate(date: string): Promise<BodyMealRecord[]> {
  const meals = await db.body_meals.where("date").equals(date).toArray();
  return meals.sort((first, second) => (first.created_at ?? 0) - (second.created_at ?? 0));
}

export async function computeTotals(date: string): Promise<{
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}> {
  const meals = await listMealsByDate(date);
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let proteinCount = 0;
  let carbsCount = 0;
  let fatCount = 0;

  for (const meal of meals) {
    calories += Math.max(0, meal.calories || 0);
    if (meal.protein !== null && meal.protein !== undefined) {
      protein += meal.protein;
      proteinCount += 1;
    }
    if (meal.carbs !== null && meal.carbs !== undefined) {
      carbs += meal.carbs;
      carbsCount += 1;
    }
    if (meal.fat !== null && meal.fat !== undefined) {
      fat += meal.fat;
      fatCount += 1;
    }
  }

  return {
    calories,
    protein: proteinCount > 0 ? protein : null,
    carbs: carbsCount > 0 ? carbs : null,
    fat: fatCount > 0 ? fat : null,
  };
}
