/**
 * Unified engine adapter that abstracts differences between Mind (UUID + separate
 * completions table) and Body/Money/General (numeric IDs + embedded completion arrays).
 *
 * Consumers of this module get a single interface regardless of engine type,
 * eliminating the need to branch on engine key in cross-engine features.
 */

import { db, type BodyTask, type MoneyTask, type GeneralTask, type MindTask } from "./db";
import { assertDateISO, todayISO } from "./date";
import type { EngineKey, DayScore } from "./scoring";
import { getDayScoreForEngine } from "./scoring";

export type UnifiedTaskId = string;

export type UnifiedEngineTask = {
  id: UnifiedTaskId;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
  daysPerWeek: number;
  engine: EngineKey;
};

export type UnifiedTaskCompletion = {
  taskId: UnifiedTaskId;
  completed: boolean;
};

export interface EngineAdapter {
  engine: EngineKey;
  listTasks(): Promise<UnifiedEngineTask[]>;
  getCompletions(dateKey: string): Promise<Map<UnifiedTaskId, boolean>>;
  getScore(dateKey: string): Promise<DayScore>;
  getStartDate(): Promise<string | null>;
}

function bodyLikeTaskToUnified(
  task: BodyTask | MoneyTask | GeneralTask,
  engine: EngineKey,
): UnifiedEngineTask {
  return {
    id: String(task.id ?? -1),
    title: task.title,
    priority: task.priority,
    createdAt: task.createdAt,
    daysPerWeek: task.daysPerWeek ?? 7,
    engine,
  };
}

function mindTaskToUnified(task: MindTask): UnifiedEngineTask {
  return {
    id: task.id,
    title: task.title,
    priority: task.kind,
    createdAt: typeof task.createdAt === "string" ? Date.parse(task.createdAt) : task.createdAt,
    daysPerWeek: task.daysPerWeek ?? 7,
    engine: "mind",
  };
}

function createBodyLikeAdapter(engine: "body" | "money" | "general"): EngineAdapter {
  const table = () =>
    engine === "body"
      ? db.body_tasks
      : engine === "money"
        ? db.money_tasks
        : db.general_tasks;

  const logTable = () =>
    engine === "body"
      ? db.body_logs
      : engine === "money"
        ? db.money_logs
        : db.general_logs;

  const metaTable = () =>
    engine === "body"
      ? db.body_meta
      : engine === "money"
        ? db.money_meta
        : db.general_meta;

  return {
    engine,

    async listTasks() {
      const tasks = await table().toArray();
      return tasks.map((t) => bodyLikeTaskToUnified(t, engine));
    },

    async getCompletions(dateKey: string) {
      const safeDate = assertDateISO(dateKey);
      const log = await logTable().where("dateKey").equals(safeDate).first();
      const map = new Map<UnifiedTaskId, boolean>();
      if (log) {
        for (const id of log.completedTaskIds) {
          map.set(String(id), true);
        }
      }
      return map;
    },

    async getScore(dateKey: string) {
      return getDayScoreForEngine(engine, dateKey);
    },

    async getStartDate() {
      const meta = await metaTable().get(engine as never);
      return meta?.startDate ?? null;
    },
  };
}

function createMindAdapter(): EngineAdapter {
  return {
    engine: "mind",

    async listTasks() {
      const tasks = await db.mind_tasks.toArray();
      return tasks.filter((t) => t.isActive !== false).map(mindTaskToUnified);
    },

    async getCompletions(dateKey: string) {
      const safeDate = assertDateISO(dateKey);
      const completions = await db.mind_task_completions
        .where("dateKey")
        .equals(safeDate)
        .toArray();
      const map = new Map<UnifiedTaskId, boolean>();
      for (const c of completions) {
        map.set(c.taskId, c.completed);
      }
      return map;
    },

    async getScore(dateKey: string) {
      return getDayScoreForEngine("mind", dateKey);
    },

    async getStartDate() {
      const meta = await db.mind_meta.get("mind");
      return meta?.startDate ?? null;
    },
  };
}

const adapters: Record<EngineKey, EngineAdapter> = {
  body: createBodyLikeAdapter("body"),
  mind: createMindAdapter(),
  money: createBodyLikeAdapter("money"),
  general: createBodyLikeAdapter("general"),
};

export function getEngineAdapter(engine: EngineKey): EngineAdapter {
  return adapters[engine];
}

/**
 * Get tasks and completions for all engines on a given date, unified.
 */
export async function getAllEngineTasksForDate(
  dateKey?: string,
): Promise<{ tasks: UnifiedEngineTask[]; completions: Map<UnifiedTaskId, boolean> }> {
  const safeDate = assertDateISO(dateKey ?? todayISO());
  const engines: EngineKey[] = ["body", "mind", "money", "general"];

  const results = await Promise.all(
    engines.map(async (engine) => {
      const adapter = getEngineAdapter(engine);
      const [tasks, completions] = await Promise.all([
        adapter.listTasks(),
        adapter.getCompletions(safeDate),
      ]);
      return { tasks, completions };
    }),
  );

  const allTasks: UnifiedEngineTask[] = [];
  const allCompletions = new Map<UnifiedTaskId, boolean>();

  for (const { tasks, completions } of results) {
    allTasks.push(...tasks);
    for (const [id, completed] of completions) {
      allCompletions.set(id, completed);
    }
  }

  return { tasks: allTasks, completions: allCompletions };
}
