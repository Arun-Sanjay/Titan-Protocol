"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../../../../lib/db";
import type {
  GymExercise,
  GymTemplate,
  GymTemplateExercise,
  GymSession,
  GymSet,
} from "../../../../../lib/db";
import {
  listExercises,
  addExercise,
  deleteExercise,
  listTemplates,
  addTemplate,
  addTemplateExercise,
  removeTemplateExercise,
  getTemplateExercises,
  reorderTemplateExercises,
  deleteTemplate,
  startSession,
  endSession,
  getActiveSession,
  listSessionHistory,
  deleteSession,
  addSet,
  updateSet,
  deleteSet,
  getSetsForSession,
  seedExerciseDatabase,
  seedTemplates,
} from "../../../../../lib/gym";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const MUSCLE_GROUPS = [
  "All",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
];

type TabKey = "exercises" | "templates" | "history";

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const [tab, setTab] = React.useState<TabKey>("templates");
  const [seeded, setSeeded] = React.useState(false);

  // Seed on mount
  React.useEffect(() => {
    (async () => {
      await seedExerciseDatabase();
      await seedTemplates();
      setSeeded(true);
    })();
  }, []);

  // Check for active session
  const activeSession = useLiveQuery(() => getActiveSession(), []);

  if (!seeded) {
    return (
      <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
        <div className="tp-panel p-6 text-center">
          <p className="tp-muted">Loading exercise database...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-2 py-2 sm:px-4 sm:py-4">
      <header className="mb-4">
        <h1 className="tp-title text-3xl font-bold md:text-4xl">WORKOUTS</h1>
        <p className="tp-subtitle mt-1 text-sm text-white/70">
          Track your gym sessions
        </p>
      </header>

      {/* Active Session Banner */}
      {activeSession && (
        <ActiveSessionView session={activeSession} />
      )}

      {/* Tab Navigation */}
      <div className="tp-tabs mb-4">
        <button
          type="button"
          className={`tp-tab ${tab === "exercises" ? "is-active" : ""}`}
          onClick={() => setTab("exercises")}
        >
          Exercises
        </button>
        <button
          type="button"
          className={`tp-tab ${tab === "templates" ? "is-active" : ""}`}
          onClick={() => setTab("templates")}
        >
          Templates
        </button>
        <button
          type="button"
          className={`tp-tab ${tab === "history" ? "is-active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
      </div>

      {/* Tab Content */}
      {tab === "exercises" && <ExerciseLibraryView />}
      {tab === "templates" && <TemplatesView />}
      {tab === "history" && <HistoryView />}
    </main>
  );
}

// ─── Exercise Library View ───────────────────────────────────────────────────

function ExerciseLibraryView() {
  const exercises = useLiveQuery(() => db.gym_exercises.toArray(), []) ?? [];
  const [search, setSearch] = React.useState("");
  const [muscleFilter, setMuscleFilter] = React.useState("All");
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newMuscleGroup, setNewMuscleGroup] = React.useState("Chest");
  const [newEquipment, setNewEquipment] = React.useState("Barbell");

  const filtered = React.useMemo(() => {
    let result = exercises;
    if (muscleFilter !== "All") {
      result = result.filter((e) => e.muscleGroup === muscleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.equipment.toLowerCase().includes(q),
      );
    }
    return result;
  }, [exercises, muscleFilter, search]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, GymExercise[]>();
    for (const ex of filtered) {
      const arr = map.get(ex.muscleGroup) ?? [];
      arr.push(ex);
      map.set(ex.muscleGroup, arr);
    }
    return map;
  }, [filtered]);

  async function handleAddExercise() {
    const name = newName.trim();
    if (!name) return;
    await addExercise(name, newMuscleGroup, newEquipment);
    setNewName("");
    setShowAddModal(false);
  }

  async function handleDeleteExercise(id: number) {
    if (!window.confirm("Delete this exercise?")) return;
    await deleteExercise(id);
  }

  return (
    <div>
      {/* Search & Filter */}
      <div className="tp-panel p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="body-input flex-1 min-w-[200px]"
          />
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="tp-button w-auto px-4"
          >
            + Add Custom Exercise
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg}
              type="button"
              onClick={() => setMuscleFilter(mg)}
              className={`tp-button tp-button-inline px-3 py-1 text-xs ${
                muscleFilter === mg ? "is-active" : ""
              }`}
            >
              {mg}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise List */}
      {Array.from(grouped.entries()).map(([group, exs]) => (
        <div key={group} className="tp-panel p-4 mb-3">
          <p className="tp-kicker mb-3">{group}</p>
          <div className="space-y-1">
            {exs.map((ex) => (
              <div key={ex.id} className="body-task-row">
                <div className="flex items-center gap-3">
                  <span>{ex.name}</span>
                  <span className="body-badge">{ex.equipment}</span>
                </div>
                <details className="body-menu">
                  <summary>...</summary>
                  <div className="body-menu-panel">
                    <button
                      type="button"
                      onClick={() => handleDeleteExercise(ex.id!)}
                    >
                      Delete
                    </button>
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="tp-panel p-6 text-center">
          <p className="tp-muted">No exercises found.</p>
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAddModal && (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Add Custom Exercise</p>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="tp-button tp-button-inline"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="body-label">Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="body-input"
                  placeholder="Exercise name"
                />
              </div>
              <div>
                <label className="body-label">Muscle Group</label>
                <select
                  value={newMuscleGroup}
                  onChange={(e) => setNewMuscleGroup(e.target.value)}
                  className="body-select"
                >
                  {MUSCLE_GROUPS.filter((g) => g !== "All").map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="body-label">Equipment</label>
                <select
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  className="body-select"
                >
                  {[
                    "Barbell",
                    "Dumbbell",
                    "Cable",
                    "Machine",
                    "Bodyweight",
                  ].map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleAddExercise}
                className="tp-button w-auto px-4"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="tp-button w-auto px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Templates View ──────────────────────────────────────────────────────────

function TemplatesView() {
  const templates = useLiveQuery(() => db.gym_templates.toArray(), []) ?? [];
  const templateExercises =
    useLiveQuery(
      () => db.gym_template_exercises.toArray(),
      [],
    ) ?? [];
  const exercises = useLiveQuery(() => db.gym_exercises.toArray(), []) ?? [];

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newTemplateName, setNewTemplateName] = React.useState("");
  const [editingTemplateId, setEditingTemplateId] = React.useState<
    number | null
  >(null);
  const [showAddExerciseModal, setShowAddExerciseModal] = React.useState(false);
  const [addExerciseSearch, setAddExerciseSearch] = React.useState("");
  const [addExerciseMuscle, setAddExerciseMuscle] = React.useState("All");

  const exerciseMap = React.useMemo(() => {
    const map = new Map<number, GymExercise>();
    for (const ex of exercises) {
      if (ex.id !== undefined) map.set(ex.id, ex);
    }
    return map;
  }, [exercises]);

  function getTemplateExs(templateId: number): GymTemplateExercise[] {
    return templateExercises
      .filter((te) => te.templateId === templateId)
      .sort((a, b) => a.order - b.order);
  }

  async function handleCreateTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    await addTemplate(name);
    setNewTemplateName("");
    setShowCreateModal(false);
  }

  async function handleDeleteTemplate(id: number) {
    if (!window.confirm("Delete this template and all its exercises?")) return;
    await deleteTemplate(id);
  }

  async function handleAddExToTemplate(exerciseId: number) {
    if (editingTemplateId === null) return;
    const existing = getTemplateExs(editingTemplateId);
    const order = existing.length;
    await addTemplateExercise(editingTemplateId, exerciseId, order);
    setShowAddExerciseModal(false);
    setAddExerciseSearch("");
  }

  async function handleRemoveExFromTemplate(teId: number) {
    await removeTemplateExercise(teId);
  }

  async function handleMoveExercise(
    templateId: number,
    teId: number,
    direction: "up" | "down",
  ) {
    const exs = getTemplateExs(templateId);
    const idx = exs.findIndex((e) => e.id === teId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === exs.length - 1) return;

    const newExs = [...exs];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newExs[idx], newExs[swapIdx]] = [newExs[swapIdx], newExs[idx]];

    const orderedIds = newExs.map((e) => e.id!);
    await reorderTemplateExercises(templateId, orderedIds);
  }

  async function handleStartWorkout(templateId: number) {
    const active = await getActiveSession();
    if (active) {
      window.alert(
        "You already have an active workout. Finish it before starting a new one.",
      );
      return;
    }
    await startSession(templateId, todayKey());
  }

  // Filtered exercises for add modal
  const filteredExercisesForAdd = React.useMemo(() => {
    let result = exercises;
    if (addExerciseMuscle !== "All") {
      result = result.filter((e) => e.muscleGroup === addExerciseMuscle);
    }
    if (addExerciseSearch.trim()) {
      const q = addExerciseSearch.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q));
    }
    return result;
  }, [exercises, addExerciseMuscle, addExerciseSearch]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="tp-kicker">Your Templates</p>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="tp-button w-auto px-4"
        >
          + Create Template
        </button>
      </div>

      {templates.length === 0 && (
        <div className="tp-panel p-6 text-center">
          <p className="tp-muted">No templates yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((tpl) => {
          const tplExs = getTemplateExs(tpl.id!);
          const isEditing = editingTemplateId === tpl.id;

          return (
            <div key={tpl.id} className="tp-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="tp-kicker text-base">{tpl.name}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartWorkout(tpl.id!)}
                    className="tp-button w-auto px-3 py-1 text-xs"
                  >
                    Start Workout
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTemplateId(isEditing ? null : tpl.id!)
                    }
                    className="tp-button tp-button-inline px-2 py-1 text-xs"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(tpl.id!)}
                    className="tp-button tp-button-inline px-2 py-1 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                {tplExs.map((te, idx) => {
                  const ex = exerciseMap.get(te.exerciseId);
                  return (
                    <div key={te.id} className="body-task-row">
                      <div className="flex items-center gap-2">
                        <span className="tp-muted text-xs w-5">
                          {idx + 1}.
                        </span>
                        <span>{ex?.name ?? "Unknown"}</span>
                        {ex && (
                          <span className="body-badge">{ex.equipment}</span>
                        )}
                      </div>
                      {isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveExercise(tpl.id!, te.id!, "up")
                            }
                            className="tp-button tp-button-inline px-1 py-0 text-xs"
                            disabled={idx === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveExercise(tpl.id!, te.id!, "down")
                            }
                            className="tp-button tp-button-inline px-1 py-0 text-xs"
                            disabled={idx === tplExs.length - 1}
                          >
                            Dn
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveExFromTemplate(te.id!)
                            }
                            className="tp-button tp-button-inline px-1 py-0 text-xs"
                          >
                            X
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExerciseModal(true);
                  }}
                  className="tp-button w-auto px-3 py-1 text-xs mt-2"
                >
                  + Add Exercise
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Create Template</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="tp-button tp-button-inline"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="body-label">Template Name</label>
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="body-input"
                  placeholder="e.g. Push Day"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleCreateTemplate}
                className="tp-button w-auto px-4"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="tp-button w-auto px-4"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise to Template Modal */}
      {showAddExerciseModal && editingTemplateId !== null && (
        <div className="body-modal">
          <div className="body-modal-panel">
            <div className="tp-panel-head">
              <p className="tp-kicker">Add Exercise</p>
              <button
                type="button"
                onClick={() => {
                  setShowAddExerciseModal(false);
                  setAddExerciseSearch("");
                }}
                className="tp-button tp-button-inline"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={addExerciseSearch}
                onChange={(e) => setAddExerciseSearch(e.target.value)}
                placeholder="Search exercises..."
                className="body-input"
              />
              <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map((mg) => (
                  <button
                    key={mg}
                    type="button"
                    onClick={() => setAddExerciseMuscle(mg)}
                    className={`tp-button tp-button-inline px-2 py-1 text-xs ${
                      addExerciseMuscle === mg ? "is-active" : ""
                    }`}
                  >
                    {mg}
                  </button>
                ))}
              </div>
              <div
                className="space-y-1"
                style={{ maxHeight: "300px", overflowY: "auto" }}
              >
                {filteredExercisesForAdd.map((ex) => (
                  <div key={ex.id} className="body-task-row">
                    <div className="flex items-center gap-2">
                      <span>{ex.name}</span>
                      <span className="body-badge">{ex.equipment}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddExToTemplate(ex.id!)}
                      className="tp-button tp-button-inline px-2 py-1 text-xs"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active Session View ─────────────────────────────────────────────────────

function ActiveSessionView({ session }: { session: GymSession }) {
  const template = useLiveQuery(
    () => (session.templateId ? db.gym_templates.get(session.templateId) : undefined),
    [session.templateId],
  );
  const templateExercises = useLiveQuery(
    () =>
      db.gym_template_exercises
        .where("templateId")
        .equals(session.templateId)
        .sortBy("order"),
    [session.templateId],
  ) ?? [];
  const exercises = useLiveQuery(() => db.gym_exercises.toArray(), []) ?? [];
  const sets =
    useLiveQuery(
      () => db.gym_sets.where("sessionId").equals(session.id!).toArray(),
      [session.id],
    ) ?? [];

  const [elapsed, setElapsed] = React.useState(0);

  // Timer
  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - session.startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  const exerciseMap = React.useMemo(() => {
    const map = new Map<number, GymExercise>();
    for (const ex of exercises) {
      if (ex.id !== undefined) map.set(ex.id, ex);
    }
    return map;
  }, [exercises]);

  const setsByExercise = React.useMemo(() => {
    const map = new Map<number, GymSet[]>();
    for (const s of sets) {
      const arr = map.get(s.exerciseId) ?? [];
      arr.push(s);
      map.set(s.exerciseId, arr);
    }
    // Sort each set array by setIndex
    for (const [, arr] of map) {
      arr.sort((a, b) => a.setIndex - b.setIndex);
    }
    return map;
  }, [sets]);

  async function handleFinishWorkout() {
    if (!window.confirm("Finish this workout?")) return;
    await endSession(session.id!);
  }

  async function handleDiscardWorkout() {
    if (!window.confirm("Discard this workout? All sets will be deleted."))
      return;
    await deleteSession(session.id!);
  }

  return (
    <div className="tp-panel p-4 mb-4" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="tp-kicker">Active Workout</p>
          <p className="text-lg font-bold text-white">
            {template?.name ?? "Workout"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono text-white">
            {formatDuration(elapsed)}
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={handleFinishWorkout}
              className="tp-button w-auto px-3 py-1 text-xs"
            >
              Finish Workout
            </button>
            <button
              type="button"
              onClick={handleDiscardWorkout}
              className="tp-button tp-button-inline w-auto px-3 py-1 text-xs"
            >
              Discard
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {templateExercises.map((te) => {
          const ex = exerciseMap.get(te.exerciseId);
          const exerciseSets = setsByExercise.get(te.exerciseId) ?? [];

          return (
            <ExerciseSetTracker
              key={te.id}
              sessionId={session.id!}
              exerciseId={te.exerciseId}
              exerciseName={ex?.name ?? "Unknown"}
              equipment={ex?.equipment ?? ""}
              sets={exerciseSets}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Exercise Set Tracker (within active session) ────────────────────────────

function ExerciseSetTracker({
  sessionId,
  exerciseId,
  exerciseName,
  equipment,
  sets,
}: {
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  equipment: string;
  sets: GymSet[];
}) {
  const [newWeight, setNewWeight] = React.useState("");
  const [newReps, setNewReps] = React.useState("");

  async function handleAddSet() {
    const weight = parseFloat(newWeight) || 0;
    const reps = parseInt(newReps) || 0;
    if (reps === 0) return;
    const setIndex = sets.length;
    await addSet(sessionId, exerciseId, setIndex, weight, reps);
    setNewWeight(newWeight); // Keep weight for convenience
    setNewReps("");
  }

  async function handleUpdateSet(
    setId: number,
    field: "weight" | "reps",
    value: string,
  ) {
    const num = field === "weight" ? parseFloat(value) || 0 : parseInt(value) || 0;
    await updateSet(setId, { [field]: num });
  }

  async function handleDeleteSet(setId: number) {
    await deleteSet(setId);
  }

  return (
    <div className="tp-panel p-3">
      <div className="flex items-center gap-2 mb-2">
        <p className="font-semibold text-white">{exerciseName}</p>
        <span className="body-badge">{equipment}</span>
      </div>

      {/* Existing sets */}
      {sets.length > 0 && (
        <div className="space-y-1 mb-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-xs tp-muted">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span></span>
          </div>
          {sets.map((s, idx) => (
            <div
              key={s.id}
              className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center"
            >
              <span className="text-xs tp-muted">{idx + 1}</span>
              <input
                type="number"
                defaultValue={s.weight}
                onBlur={(e) =>
                  handleUpdateSet(s.id!, "weight", e.target.value)
                }
                className="body-input py-1 text-sm"
                step="0.5"
              />
              <input
                type="number"
                defaultValue={s.reps}
                onBlur={(e) =>
                  handleUpdateSet(s.id!, "reps", e.target.value)
                }
                className="body-input py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => handleDeleteSet(s.id!)}
                className="tp-button tp-button-inline px-1 py-0 text-xs"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new set */}
      <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 items-center">
        <span className="text-xs tp-muted">{sets.length + 1}</span>
        <input
          type="number"
          value={newWeight}
          onChange={(e) => setNewWeight(e.target.value)}
          placeholder="lbs"
          className="body-input py-1 text-sm"
          step="0.5"
        />
        <input
          type="number"
          value={newReps}
          onChange={(e) => setNewReps(e.target.value)}
          placeholder="reps"
          className="body-input py-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddSet();
          }}
        />
        <button
          type="button"
          onClick={handleAddSet}
          className="tp-button w-auto px-3 py-1 text-xs"
        >
          + Set
        </button>
      </div>
    </div>
  );
}

// ─── History View ────────────────────────────────────────────────────────────

function HistoryView() {
  const sessions =
    useLiveQuery(
      () => db.gym_sessions.orderBy("id").reverse().limit(50).toArray(),
      [],
    ) ?? [];
  const templates = useLiveQuery(() => db.gym_templates.toArray(), []) ?? [];
  const [expandedSessionId, setExpandedSessionId] = React.useState<
    number | null
  >(null);

  const templateMap = React.useMemo(() => {
    const map = new Map<number, GymTemplate>();
    for (const t of templates) {
      if (t.id !== undefined) map.set(t.id, t);
    }
    return map;
  }, [templates]);

  // Only show completed sessions (endedAt !== null)
  const completedSessions = sessions.filter((s) => s.endedAt !== null);

  async function handleDeleteSession(id: number) {
    if (!window.confirm("Delete this session and all its sets?")) return;
    await deleteSession(id);
    if (expandedSessionId === id) setExpandedSessionId(null);
  }

  return (
    <div>
      <p className="tp-kicker mb-3">Workout History</p>

      {completedSessions.length === 0 && (
        <div className="tp-panel p-6 text-center">
          <p className="tp-muted">
            No completed workouts yet. Start a workout from the Templates tab.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {completedSessions.map((s) => {
          const tpl = templateMap.get(s.templateId);
          const duration =
            s.endedAt && s.startedAt ? s.endedAt - s.startedAt : 0;
          const isExpanded = expandedSessionId === s.id;

          return (
            <div key={s.id} className="tp-panel p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedSessionId(isExpanded ? null : s.id!)
                }
              >
                <div>
                  <p className="font-semibold text-white">
                    {tpl?.name ?? "Workout"}
                  </p>
                  <p className="text-xs tp-muted">
                    {formatDate(s.dateKey)} -- {formatDuration(duration)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tp-muted">
                    {isExpanded ? "Collapse" : "Expand"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(s.id!);
                    }}
                    className="tp-button tp-button-inline px-2 py-1 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isExpanded && <SessionDetails sessionId={s.id!} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Session Details (expanded history item) ─────────────────────────────────

function SessionDetails({ sessionId }: { sessionId: number }) {
  const sets =
    useLiveQuery(
      () => db.gym_sets.where("sessionId").equals(sessionId).toArray(),
      [sessionId],
    ) ?? [];
  const exercises = useLiveQuery(() => db.gym_exercises.toArray(), []) ?? [];

  const exerciseMap = React.useMemo(() => {
    const map = new Map<number, GymExercise>();
    for (const ex of exercises) {
      if (ex.id !== undefined) map.set(ex.id, ex);
    }
    return map;
  }, [exercises]);

  // Group sets by exercise
  const grouped = React.useMemo(() => {
    const map = new Map<number, GymSet[]>();
    for (const s of sets) {
      const arr = map.get(s.exerciseId) ?? [];
      arr.push(s);
      map.set(s.exerciseId, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.setIndex - b.setIndex);
    }
    return map;
  }, [sets]);

  if (sets.length === 0) {
    return (
      <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <p className="tp-muted text-xs">No sets recorded.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      {Array.from(grouped.entries()).map(([exerciseId, exSets]) => {
        const ex = exerciseMap.get(exerciseId);
        return (
          <div key={exerciseId}>
            <p className="text-sm font-semibold text-white mb-1">
              {ex?.name ?? "Unknown"}
              {ex && (
                <span className="body-badge ml-2">{ex.equipment}</span>
              )}
            </p>
            <div className="space-y-0.5">
              {exSets.map((s, idx) => (
                <p key={s.id} className="text-xs tp-muted">
                  Set {idx + 1}: {s.weight} lbs x {s.reps} reps
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
