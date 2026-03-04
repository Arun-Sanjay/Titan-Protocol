import Dexie, { type Table } from "dexie";

export type BodyMeta = {
  id: "body";
  startDate: string;
  createdAt: number;
};

export type BodyTask = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
};

export type BodyLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type MindMeta = {
  id: "mind";
  startDate: string;
  createdAt: number;
};

export type MindTask = {
  id: string;
  created_at: string;
  title: string;
  kind: "main" | "secondary";
  is_active: boolean;
};

export type MindTaskCompletion = {
  id: string;
  dateISO: string;
  task_id: string;
  completed: boolean;
  completed_at: string | null;
};

export type MoneyMeta = {
  id: "money";
  startDate: string;
  createdAt: number;
};

export type MoneyTask = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
};

export type MoneyLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type GeneralMeta = {
  id: "general";
  startDate: string;
  createdAt: number;
};

export type GeneralTask = {
  id?: number;
  title: string;
  priority: "main" | "secondary";
  createdAt: number;
};

export type GeneralLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

export type NutritionProfile = {
  id: string;
  created_at: string;
  updated_at: string;
  height_cm: number;
  weight_kg: number;
  age: number;
  sex: "male" | "female";
  bodyfat_pct: number | null;
  steps_per_day: number;
  workouts_per_week: number;
  activity_multiplier: number;
  goal: "cut" | "bulk" | "maintain";
  rate_kg_per_week: 0 | 0.25 | 0.5 | 0.75 | 1;
  calorie_target: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

export type NutritionMeal = {
  id: string;
  dateISO: string;
  created_at: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
};

class TitanBodyDB extends Dexie {
  body_meta!: Table<BodyMeta, "body">;
  body_tasks!: Table<BodyTask, number>;
  body_logs!: Table<BodyLog, number>;
  mind_meta!: Table<MindMeta, "mind">;
  mind_tasks!: Table<MindTask, string>;
  mind_task_completions!: Table<MindTaskCompletion, string>;
  money_meta!: Table<MoneyMeta, "money">;
  money_tasks!: Table<MoneyTask, number>;
  money_logs!: Table<MoneyLog, number>;
  general_meta!: Table<GeneralMeta, "general">;
  general_tasks!: Table<GeneralTask, number>;
  general_logs!: Table<GeneralLog, number>;
  nutrition_profiles!: Table<NutritionProfile, string>;
  nutrition_meals!: Table<NutritionMeal, string>;

  constructor() {
    super("TitanProtocolBodyDB");
    this.version(1).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, isActive",
      body_logs: "++id, dateKey",
    });
    this.version(2)
      .stores({
        body_meta: "id",
        body_tasks: "++id, dateKey, priority, completed, createdAt",
        body_logs: "++id, dateKey",
      })
      .upgrade(async (tx) => {
        await tx.table("body_tasks").clear();
      });
    this.version(3)
      .stores({
        body_meta: "id",
        body_tasks: "++id, createdAt, priority",
        body_logs: "++id, dateKey",
      })
      .upgrade(async (tx) => {
        const oldTasks = await tx.table("body_tasks").toArray();
        const oldLogs = await tx.table("body_logs").toArray();

        const defsMap = new Map<string, { title: string; priority: "main" | "secondary"; createdAt: number }>();
        let earliestDate: string | null = null;

        for (const task of oldTasks as Array<
          BodyTask & { dateKey?: string; completed?: boolean; priority?: "main" | "secondary" }
        >) {
          const priority = task.priority ?? "main";
          const key = `${task.title}::${priority}`;
          const existing = defsMap.get(key);
          const createdAt = task.createdAt ?? Date.now();
          if (!existing || createdAt < existing.createdAt) {
            defsMap.set(key, { title: task.title, priority, createdAt });
          }
          if (task.dateKey) {
            if (!earliestDate || task.dateKey < earliestDate) earliestDate = task.dateKey;
          }
        }

        const defs = Array.from(defsMap.values());
        await tx.table("body_tasks").clear();
        const ids = defs.length
          ? await tx.table("body_tasks").bulkAdd(defs, { allKeys: true })
          : [];

        const keyToId = new Map<string, number>();
        defs.forEach((def, index) => {
          const id = ids[index] as number;
          keyToId.set(`${def.title}::${def.priority}`, id);
        });

        const logMap = new Map<string, Set<number>>();
        for (const task of oldTasks as Array<
          BodyTask & { dateKey?: string; completed?: boolean; priority?: "main" | "secondary" }
        >) {
          if (!task.dateKey || !task.completed) continue;
          const priority = task.priority ?? "main";
          const key = `${task.title}::${priority}`;
          const id = keyToId.get(key);
          if (!id) continue;
          const set = logMap.get(task.dateKey) ?? new Set<number>();
          set.add(id);
          logMap.set(task.dateKey, set);
        }

        for (const log of oldLogs as Array<BodyLog>) {
          if (!log.dateKey || !log.completedTaskIds?.length) continue;
          const set = logMap.get(log.dateKey) ?? new Set<number>();
          log.completedTaskIds.forEach((id) => set.add(id));
          logMap.set(log.dateKey, set);
        }

        const logs = Array.from(logMap.entries()).map(([dateKey, set]) => ({
          dateKey,
          completedTaskIds: Array.from(set),
          createdAt: Date.now(),
        }));

        await tx.table("body_logs").clear();
        if (logs.length) {
          await tx.table("body_logs").bulkAdd(logs);
        }

        if (earliestDate) {
          const meta = await tx.table("body_meta").get("body");
          if (meta) {
            const nextStartDate = meta.startDate && meta.startDate < earliestDate ? meta.startDate : earliestDate;
            await tx.table("body_meta").update("body", { startDate: nextStartDate });
          }
        }
      });
    this.version(4).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(5).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(6).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(7).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
    this.version(8).stores({
      body_meta: "id",
      body_tasks: "++id, createdAt, priority",
      body_logs: "++id, dateKey",
      mind_meta: "id",
      mind_tasks: "id, created_at, kind, is_active",
      mind_task_completions: "id, dateISO, task_id, completed, [dateISO+task_id]",
      money_meta: "id",
      money_tasks: "++id, createdAt, priority",
      money_logs: "++id, dateKey",
      general_meta: "id",
      general_tasks: "++id, createdAt, priority",
      general_logs: "++id, dateKey",
      nutrition_profiles: "id, updated_at",
      nutrition_meals: "id, dateISO, created_at",
    });
  }
}

export const db = new TitanBodyDB();
