"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type BodyTask, type GeneralTask, type MoneyTask } from "@/lib/db";

type TaskWithCompletion<T> = T & { completed: boolean };

const EMPTY_BODY_TASKS: BodyTask[] = [];
const EMPTY_MONEY_TASKS: MoneyTask[] = [];
const EMPTY_GENERAL_TASKS: GeneralTask[] = [];

/**
 * Reactive hook for Body engine tasks + completion state for a given date.
 */
export function useBodyTasks(dateKey: string) {
  const tasks = useLiveQuery(() => db.body_tasks.toArray(), []) ?? EMPTY_BODY_TASKS;
  const log = useLiveQuery(
    () => db.body_logs.where("dateKey").equals(dateKey).first(),
    [dateKey],
  );
  const completedIds = React.useMemo(
    () => new Set(log?.completedTaskIds ?? []),
    [log],
  );
  const tasksWithCompletion: TaskWithCompletion<BodyTask>[] = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id ?? -1) })),
    [tasks, completedIds],
  );
  return { tasks, tasksWithCompletion, completedIds };
}

/**
 * Reactive hook for Money engine tasks + completion state for a given date.
 */
export function useMoneyTasks(dateKey: string) {
  const tasks = useLiveQuery(() => db.money_tasks.toArray(), []) ?? EMPTY_MONEY_TASKS;
  const log = useLiveQuery(
    () => db.money_logs.where("dateKey").equals(dateKey).first(),
    [dateKey],
  );
  const completedIds = React.useMemo(
    () => new Set(log?.completedTaskIds ?? []),
    [log],
  );
  const tasksWithCompletion: TaskWithCompletion<MoneyTask>[] = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id ?? -1) })),
    [tasks, completedIds],
  );
  return { tasks, tasksWithCompletion, completedIds };
}

/**
 * Reactive hook for General engine tasks + completion state for a given date.
 */
export function useGeneralTasks(dateKey: string) {
  const tasks = useLiveQuery(() => db.general_tasks.toArray(), []) ?? EMPTY_GENERAL_TASKS;
  const log = useLiveQuery(
    () => db.general_logs.where("dateKey").equals(dateKey).first(),
    [dateKey],
  );
  const completedIds = React.useMemo(
    () => new Set(log?.completedTaskIds ?? []),
    [log],
  );
  const tasksWithCompletion: TaskWithCompletion<GeneralTask>[] = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id ?? -1) })),
    [tasks, completedIds],
  );
  return { tasks, tasksWithCompletion, completedIds };
}

/**
 * Reactive hook for Mind engine tasks + completion state for a given date.
 * Mind uses UUIDs and a separate completions table, so it gets its own hook.
 */
export function useMindTasks(dateKey: string) {
  const allTasks = useLiveQuery(() => db.mind_tasks.toArray(), []) ?? [];
  const tasks = React.useMemo(
    () => allTasks.filter((t) => t.isActive !== false),
    [allTasks],
  );
  const completions = useLiveQuery(
    () => db.mind_task_completions.where("dateKey").equals(dateKey).toArray(),
    [dateKey],
  ) ?? [];
  const completedIds = React.useMemo(
    () => new Set(completions.filter((c) => c.completed).map((c) => c.taskId)),
    [completions],
  );
  const tasksWithCompletion = React.useMemo(
    () => tasks.map((task) => ({ ...task, completed: completedIds.has(task.id) })),
    [tasks, completedIds],
  );
  return { tasks, tasksWithCompletion, completedIds };
}
