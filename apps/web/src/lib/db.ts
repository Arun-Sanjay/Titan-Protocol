import Dexie, { type Table } from "dexie";

export type BodyMeta = {
  id: "body";
  startDate: string;
  createdAt: number;
};

export type BodyTask = {
  id?: number;
  dateKey: string;
  title: string;
  priority: "main" | "secondary";
  completed: boolean;
  createdAt: number;
};

export type BodyLog = {
  id?: number;
  dateKey: string;
  completedTaskIds: number[];
  createdAt: number;
};

class TitanBodyDB extends Dexie {
  body_meta!: Table<BodyMeta, "body">;
  body_tasks!: Table<BodyTask, number>;
  body_logs!: Table<BodyLog, number>;

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
  }
}

export const db = new TitanBodyDB();
