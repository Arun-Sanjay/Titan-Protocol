import { db } from "./db";

export type ExerciseHistoryRow = {
  workout_id: number;
  workout_title: string;
  date: string;
  set_id: number;
  set_index: number;
  weight: number;
  reps: number;
  estimated1RM: number;
  done: boolean;
};

export type BestSetResult = {
  workout_id: number;
  workout_title: string;
  date: string;
  set_id: number;
  set_index: number;
  weight: number;
  reps: number;
  estimated1RM: number;
  volume: number;
};

export type LastWorkoutExerciseResult = {
  workout_id: number;
  workout_title: string;
  date: string;
  weight: number;
  reps: number;
  estimated1RM: number;
};

export function estimate1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

async function getExerciseRows(exercise_id: number) {
  return db.workout_exercises.where("exercise_id").equals(exercise_id).toArray();
}

export async function getExerciseHistory(
  exercise_id: number,
  limit = 20,
): Promise<ExerciseHistoryRow[]> {
  const exerciseRows = await getExerciseRows(exercise_id);
  if (exerciseRows.length === 0) return [];

  const exerciseByWorkoutExerciseId = new Map(
    exerciseRows.map((row) => [row.id as number, row] as const),
  );
  const workouts = await db.workouts.toArray();
  const workoutById = new Map(workouts.map((workout) => [workout.id as number, workout] as const));
  const sets = await db.workout_sets.toArray();

  const result: ExerciseHistoryRow[] = [];
  for (const set of sets) {
    const exerciseRow = exerciseByWorkoutExerciseId.get(set.workout_exercise_id);
    if (!exerciseRow || set.done === false) continue;
    const workout = workoutById.get(exerciseRow.workout_id);
    if (!workout?.id) continue;

    result.push({
      workout_id: workout.id,
      workout_title: workout.title,
      date: workout.date,
      set_id: set.id as number,
      set_index: set.set_index,
      weight: set.weight,
      reps: set.reps,
      estimated1RM: estimate1RM(set.weight, set.reps),
      done: true,
    });
  }

  return result
    .sort((first, second) => {
      if (first.date === second.date) {
        if (first.workout_id === second.workout_id) {
          return second.set_index - first.set_index;
        }
        return second.workout_id - first.workout_id;
      }
      return second.date.localeCompare(first.date);
    })
    .slice(0, limit);
}

export async function getBestSet(exercise_id: number): Promise<BestSetResult | undefined> {
  const history = await getExerciseHistory(exercise_id, 200);
  if (history.length === 0) return undefined;

  const best = [...history].sort((first, second) => {
    if (second.estimated1RM !== first.estimated1RM) {
      return second.estimated1RM - first.estimated1RM;
    }
    const firstVolume = first.weight * first.reps;
    const secondVolume = second.weight * second.reps;
    if (secondVolume !== firstVolume) return secondVolume - firstVolume;
    return second.date.localeCompare(first.date);
  })[0];

  return {
    workout_id: best.workout_id,
    workout_title: best.workout_title,
    date: best.date,
    set_id: best.set_id,
    set_index: best.set_index,
    weight: best.weight,
    reps: best.reps,
    estimated1RM: best.estimated1RM,
    volume: best.weight * best.reps,
  };
}

export async function getLastWorkoutForExercise(
  exercise_id: number,
): Promise<LastWorkoutExerciseResult | undefined> {
  const history = await getExerciseHistory(exercise_id, 100);
  if (history.length === 0) return undefined;

  const newestDate = history[0].date;
  const newestWorkoutId = history[0].workout_id;
  const sameWorkout = history.filter(
    (item) => item.date === newestDate && item.workout_id === newestWorkoutId,
  );
  const lastSet = [...sameWorkout].sort((first, second) => second.set_index - first.set_index)[0];

  return {
    workout_id: lastSet.workout_id,
    workout_title: lastSet.workout_title,
    date: lastSet.date,
    weight: lastSet.weight,
    reps: lastSet.reps,
    estimated1RM: lastSet.estimated1RM,
  };
}
