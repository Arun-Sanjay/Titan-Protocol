import { db, type MindMeta, type MindTask, type MindTaskCompletion } from "./db";
import { uid } from "./id";
import { assertDateISO, isDateISO, monthBounds, todayISO } from "./date";
import { assertIDBKey } from "./idb_debug";

export async function ensureMindMeta(dateISO: string): Promise<MindMeta> {
  const safeDate = assertDateISO(dateISO);
  const existing = await db.mind_meta.get("mind");
  if (existing) {
    if (safeDate < existing.startDate) {
      await db.mind_meta.update("mind", { startDate: safeDate });
      return { ...existing, startDate: safeDate };
    }
    return existing;
  }
  const meta: MindMeta = { id: "mind", startDate: safeDate, createdAt: Date.now() };
  await db.mind_meta.put(meta);
  return meta;
}

export async function getMindStartDate(): Promise<string | null> {
  const meta = await db.mind_meta.get("mind");
  return meta?.startDate ?? null;
}

export async function addMindTask({
  title,
  kind,
  dateISO,
  daysPerWeek = 7,
}: {
  title: string;
  kind: "main" | "secondary";
  dateISO?: string;
  daysPerWeek?: number;
}) {
  try {
  if (!db.mind_tasks) {
    throw new Error("mind_tasks table missing - check db.ts schema/version");
  }
  const task: MindTask = {
    id: uid(),
    createdAt: new Date().toISOString(),
    title,
    kind,
    isActive: true,
    daysPerWeek,
  };
  await db.mind_tasks.put(task);
  if (dateISO) {
    await ensureMindMeta(assertDateISO(dateISO));
  }
  return task;
  } catch (err) {
    console.error("[mind.ts:addMindTask]", err);
    throw err;
  }
}

export async function listMindTasks(): Promise<MindTask[]> {
  try {
    const all = await db.mind_tasks.toArray();
    return all.filter((task) => task.isActive !== false);
  } catch (err) {
    console.error("[mind.ts:listMindTasks]", err);
    throw err;
  }
}

export async function deleteMindTask(taskId: string) {
  if (!taskId) return;
  try {
    await db.mind_tasks.delete(taskId);
    const allCompletions = await db.mind_task_completions.toArray();
    const toDelete = allCompletions.filter((entry) => entry.taskId === taskId);
    await Promise.all(toDelete.map((entry) => db.mind_task_completions.delete(entry.id)));
  } catch (err) {
    console.error("[mind.ts:deleteMindTask]", err);
    throw err;
  }
}

export async function updateMindTaskKind(taskId: string, kind: "main" | "secondary") {
  if (!taskId) return;
  try {
    await db.mind_tasks.update(taskId, { kind });
  } catch (err) {
    console.error("[mind.ts:updateMindTaskKind]", err);
    throw err;
  }
}

export async function renameMindTask(taskId: string, title: string) {
  if (!taskId) return;
  try {
    await db.mind_tasks.update(taskId, { title });
  } catch (err) {
    console.error("[mind.ts:renameMindTask]", err);
    throw err;
  }
}

export async function listMindCompletions(dateISO: string): Promise<MindTaskCompletion[]> {
  try {
    const candidate = dateISO ?? todayISO();
    if (!isDateISO(candidate)) return [];
    assertIDBKey("mind.completions.equals(dateKey)", candidate);
    const all = await db.mind_task_completions.toArray();
    return all.filter((entry) => entry.dateKey === candidate);
  } catch (err) {
    console.error("[mind.ts:listMindCompletions]", err);
    throw err;
  }
}

export async function setMindTaskCompletion(dateISO: string, taskId: string, completed: boolean) {
  try {
    const safeDate = assertDateISO(dateISO ?? todayISO());
    assertIDBKey("mind.completions.byKey(dateKey)", safeDate);
    assertIDBKey("mind.completions.byKey(taskId)", taskId);
    const all = await db.mind_task_completions.toArray();
    const existing = all.find((entry) => entry.dateKey === safeDate && entry.taskId === taskId);
    const completedAt = completed ? new Date().toISOString() : null;
    if (existing) {
      await db.mind_task_completions.update(existing.id, { completed, completedAt });
      await ensureMindMeta(safeDate);
      return { ...existing, completed, completedAt };
    }
    const entry: MindTaskCompletion = {
      id: uid(),
      dateKey: safeDate,
      taskId: taskId,
      completed,
      completedAt,
    };
    await db.mind_task_completions.add(entry);
    await ensureMindMeta(safeDate);
    return entry;
  } catch (err) {
    console.error("[mind.ts:setMindTaskCompletion]", err);
    throw err;
  }
}

export async function computeMindDayScore(dateISO: string) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const [tasks, completions] = await Promise.all([listMindTasks(), listMindCompletions(safeDate)]);
  const completedSet = new Set(completions.filter((c) => c.completed).map((c) => c.taskId));

  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completedSet.has(task.id)).length;
  const secondaryDone = secondaryTasks.filter((task) => completedSet.has(task.id)).length;

  const mainTotal = mainTasks.length;
  const secondaryTotal = secondaryTasks.length;
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);

  return {
    percent,
    mainDone,
    mainTotal,
    secondaryDone,
    secondaryTotal,
    pointsDone,
    pointsTotal,
  };
}

export async function getMindScoreMapForRange(dateISO: string) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const { start, end } = monthBounds(safeDate);
  const [tasks, completions] = await Promise.all([
    listMindTasks(),
    db.mind_task_completions.toArray(),
  ]);

  const byDate = new Map<string, Set<string>>();
  for (const completion of completions) {
    if (typeof completion.dateKey !== "string") continue;
    if (completion.dateKey < start || completion.dateKey >= end) continue;
    if (!completion.completed) continue;
    const set = byDate.get(completion.dateKey) ?? new Set<string>();
    set.add(completion.taskId);
    byDate.set(completion.dateKey, set);
  }

  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const map: Record<string, number> = {};
  const dates = new Set<string>([...byDate.keys()]);
  for (const dateISO of dates) {
    const set = byDate.get(dateISO) ?? new Set<string>();
    const mainDone = mainTasks.filter((task) => set.has(task.id)).length;
    const secondaryDone = secondaryTasks.filter((task) => set.has(task.id)).length;
    const pointsTotal = mainTasks.length * 2 + secondaryTasks.length;
    const pointsDone = mainDone * 2 + secondaryDone;
    map[dateISO] = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);
  }
  return map;
}
