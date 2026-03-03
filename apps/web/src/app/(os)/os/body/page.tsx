"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  addBodyTask,
  deleteBodyTask,
  ensureBodyMeta,
  listBodyTasksByDate,
  toggleBodyTask,
  updateBodyTaskPriority,
} from "../../../../lib/body";
import type { BodyTask } from "../../../../lib/db";
import { computeBodyDayScore } from "../../../../lib/bodyScore";
import { BodyCalendar } from "../../../../components/body/BodyCalendar";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function BodyContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedDateKey, setSelectedDateKey] = React.useState<string>(() => {
    return searchParams.get("date") ?? toDateKey(new Date());
  });
  const [tasks, setTasks] = React.useState<BodyTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = React.useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = React.useState<"main" | "secondary">("main");
  const [isAddingTask, setIsAddingTask] = React.useState<boolean>(false);
  const [calendarTick, setCalendarTick] = React.useState(0);

  React.useEffect(() => {
    const queryDate = searchParams.get("date");
    if (queryDate && queryDate !== selectedDateKey) {
      setSelectedDateKey(queryDate);
    }
  }, [searchParams, selectedDateKey]);

  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", selectedDateKey);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    localStorage.setItem("bodySelectedDate", selectedDateKey);
  }, [selectedDateKey, pathname, router, searchParams]);

  React.useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      await ensureBodyMeta(selectedDateKey);
      const storedTasks = await listBodyTasksByDate(selectedDateKey);

      if (!isMounted) return;
      setTasks(storedTasks);
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [selectedDateKey]);

  async function handleToggleTask(task: BodyTask) {
    if (!task.id) return;
    const nextCompleted = !task.completed;
    await toggleBodyTask(task.id, nextCompleted);
    const storedTasks = await listBodyTasksByDate(selectedDateKey);
    setTasks(storedTasks);
    setCalendarTick((prev) => prev + 1);
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    await addBodyTask(selectedDateKey, title, newTaskPriority);
    const storedTasks = await listBodyTasksByDate(selectedDateKey);
    setTasks(storedTasks);
    setCalendarTick((prev) => prev + 1);
    setNewTaskTitle("");
    setNewTaskPriority("main");
    setIsAddingTask(false);
  }

  const mainTasks = tasks.filter((task) => task.priority === "main");
  const secondaryTasks = tasks.filter((task) => task.priority === "secondary");
  const hasTasks = tasks.length > 0;
  const score = computeBodyDayScore(tasks);

  React.useEffect(() => {
    const queryDate = searchParams.get("date");
    if (queryDate) return;
    const saved = localStorage.getItem("bodySelectedDate");
    if (saved) {
      setSelectedDateKey(saved);
    }
  }, [searchParams]);

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-5">
        <h1 className="tp-title text-3xl font-bold md:text-4xl">BODY ENGINE</h1>
        <p className="tp-subtitle mt-3 text-sm text-white/70">Forever tracker • {selectedDateKey}</p>
      </header>

      <BodyCalendar
        selectedDateKey={selectedDateKey}
        onSelectDate={setSelectedDateKey}
        refreshKey={calendarTick}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <div>
              <p className="tp-kicker">Day Score</p>
              <p className="tp-score-value text-3xl">{score.percent}%</p>
            </div>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>
          <p className="mt-3 text-sm text-white/65">
            Main {score.mainDone}/{score.mainTotal} • Secondary {score.secondaryDone}/{score.secondaryTotal} • Points{" "}
            {score.pointsDone}/{score.pointsTotal}
          </p>
          <div className="tp-progress mt-3">
            <span style={{ width: `${score.percent}%` }} />
          </div>
        </section>

        <section className="tp-panel p-5 sm:p-6">
          <div className="tp-panel-head">
            <p className="tp-kicker">Tasks</p>
            <p className="tp-muted">{selectedDateKey}</p>
          </div>

          {!hasTasks ? (
            <div className="mt-5 rounded-md border border-white/10 bg-black/40 px-4 py-6 text-sm text-white/60">
              <p>No tasks for this date.</p>
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="tp-button mt-4 inline-flex w-auto px-4"
              >
                Add Task
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              <div>
                <p className="tp-kicker">Main Tasks</p>
                <div className="mt-3 space-y-2">
                  {mainTasks.length === 0 ? (
                    <div className="body-empty">No main tasks.</div>
                  ) : (
                    mainTasks.map((task) => (
                      <div key={task.id} className="body-task-row">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTask(task)}
                            className="h-4 w-4 accent-white"
                          />
                          <span>{task.title}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="body-badge">MAIN</span>
                          <details className="body-menu">
                            <summary>•••</summary>
                            <div className="body-menu-panel">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!task.id) return;
                                  await updateBodyTaskPriority(task.id, "secondary");
                                  const stored = await listBodyTasksByDate(selectedDateKey);
                                  setTasks(stored);
                                }}
                              >
                                Move to Secondary
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!task.id) return;
                                  await deleteBodyTask(task.id);
                                  const stored = await listBodyTasksByDate(selectedDateKey);
                                  setTasks(stored);
                                  setCalendarTick((prev) => prev + 1);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="tp-kicker">Secondary Tasks</p>
                <div className="mt-3 space-y-2">
                  {secondaryTasks.length === 0 ? (
                    <div className="body-empty">No secondary tasks.</div>
                  ) : (
                    secondaryTasks.map((task) => (
                      <div key={task.id} className="body-task-row">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTask(task)}
                            className="h-4 w-4 accent-white"
                          />
                          <span>{task.title}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="body-badge">SECONDARY</span>
                          <details className="body-menu">
                            <summary>•••</summary>
                            <div className="body-menu-panel">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!task.id) return;
                                  await updateBodyTaskPriority(task.id, "main");
                                  const stored = await listBodyTasksByDate(selectedDateKey);
                                  setTasks(stored);
                                }}
                              >
                                Move to Main
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!task.id) return;
                                  await deleteBodyTask(task.id);
                                  const stored = await listBodyTasksByDate(selectedDateKey);
                                  setTasks(stored);
                                  setCalendarTick((prev) => prev + 1);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="tp-button mt-3 inline-flex w-auto px-4"
              >
                Add Task
              </button>
            </div>
          )}

          {isAddingTask ? (
            <div className="body-modal">
              <div className="body-modal-panel">
                <div className="tp-panel-head">
                  <p className="tp-kicker">New Task</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskTitle("");
                    }}
                    className="tp-button tp-button-inline"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="body-label">Title</label>
                    <input
                      value={newTaskTitle}
                      onChange={(event) => setNewTaskTitle(event.target.value)}
                      className="body-input"
                      placeholder="Task title"
                    />
                  </div>
                  <div>
                    <label className="body-label">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(event) => setNewTaskPriority(event.target.value as "main" | "secondary")}
                      className="body-select"
                    >
                      <option value="main">Main (2 pts)</option>
                      <option value="secondary">Secondary (1 pt)</option>
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={handleAddTask} className="tp-button w-auto px-4">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskTitle("");
                    }}
                    className="tp-button w-auto px-4"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function BodyTodayPage() {
  return (
    <React.Suspense
      fallback={
        <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
          <section className="tp-panel p-6">
            <h1 className="tp-title text-3xl font-bold md:text-4xl">BODY ENGINE</h1>
            <p className="mt-3 text-sm text-white/70">Loading...</p>
          </section>
        </main>
      }
    >
      <BodyContent />
    </React.Suspense>
  );
}
