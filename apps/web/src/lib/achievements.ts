import { db, type Achievement } from "./db";

// ---------------------------------------------------------------------------
// Achievement definitions
// ---------------------------------------------------------------------------

export type AchievementDef = {
  type: string;
  title: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Streaks
  { type: "streak_3", title: "Getting Started", description: "3-day consistency streak", icon: "🔥" },
  { type: "streak_7", title: "Week Warrior", description: "7-day consistency streak", icon: "🔥" },
  { type: "streak_14", title: "Two Weeks Strong", description: "14-day consistency streak", icon: "💪" },
  { type: "streak_30", title: "Monthly Master", description: "30-day consistency streak", icon: "⚡" },
  { type: "streak_100", title: "Centurion", description: "100-day consistency streak", icon: "👑" },

  // Task milestones
  { type: "tasks_10", title: "First Steps", description: "Complete 10 tasks", icon: "📋" },
  { type: "tasks_50", title: "Task Machine", description: "Complete 50 tasks", icon: "⚙️" },
  { type: "tasks_100", title: "Century Club", description: "Complete 100 tasks", icon: "🏆" },
  { type: "tasks_500", title: "Unstoppable", description: "Complete 500 tasks", icon: "🚀" },

  // Titan Score
  { type: "titan_80", title: "High Performer", description: "Achieve 80%+ Titan Score", icon: "⭐" },
  { type: "titan_100", title: "Perfect Day", description: "Achieve 100% Titan Score", icon: "💎" },

  // Engine milestones
  { type: "all_engines", title: "Full Power", description: "All 4 engines active in one day", icon: "🔋" },
  { type: "first_habit", title: "Habit Builder", description: "Create your first habit", icon: "🌱" },
  { type: "first_journal", title: "Dear Diary", description: "Write your first journal entry", icon: "📝" },
  { type: "first_goal", title: "Goal Setter", description: "Create your first goal", icon: "🎯" },
  { type: "first_workout", title: "Gym Rat", description: "Complete your first workout", icon: "🏋️" },
  { type: "first_focus", title: "Deep Focus", description: "Complete your first focus session", icon: "🧘" },

  // Habits
  { type: "habits_5", title: "Habit Master", description: "Track 5 habits simultaneously", icon: "✨" },
  { type: "habit_streak_30", title: "Iron Discipline", description: "30-day habit streak", icon: "🔗" },
];

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getUnlockedAchievements(): Promise<Achievement[]> {
  return db.achievements.orderBy("unlockedAt").reverse().toArray();
}

export async function isAchievementUnlocked(type: string): Promise<boolean> {
  const count = await db.achievements.where("type").equals(type).count();
  return count > 0;
}

export async function unlockAchievement(type: string): Promise<boolean> {
  const already = await isAchievementUnlocked(type);
  if (already) return false;

  await db.achievements.add({
    type,
    unlockedAt: Date.now(),
  });

  return true; // newly unlocked
}

// ---------------------------------------------------------------------------
// Check & unlock logic
// ---------------------------------------------------------------------------

export async function checkAndUnlockAchievements(): Promise<AchievementDef[]> {
  const newlyUnlocked: AchievementDef[] = [];

  // Check habit count
  const habitCount = await db.habits.count();
  if (habitCount >= 1) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.type === "first_habit");
    if (def && (await unlockAchievement("first_habit"))) newlyUnlocked.push(def);
  }
  if (habitCount >= 5) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.type === "habits_5");
    if (def && (await unlockAchievement("habits_5"))) newlyUnlocked.push(def);
  }

  // Check journal entries
  const journalCount = await db.journal_entries.count();
  if (journalCount >= 1) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.type === "first_journal");
    if (def && (await unlockAchievement("first_journal"))) newlyUnlocked.push(def);
  }

  // Check goals
  const goalCount = await db.goals.count();
  if (goalCount >= 1) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.type === "first_goal");
    if (def && (await unlockAchievement("first_goal"))) newlyUnlocked.push(def);
  }

  // Check workout sessions
  const sessionCount = await db.gym_sessions.count();
  if (sessionCount >= 1) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.type === "first_workout");
    if (def && (await unlockAchievement("first_workout"))) newlyUnlocked.push(def);
  }

  // Check focus sessions
  const focusRows = await db.focus_daily.toArray();
  const totalFocus = focusRows.reduce((sum, r) => sum + r.completedSessions, 0);
  if (totalFocus >= 1) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.type === "first_focus");
    if (def && (await unlockAchievement("first_focus"))) newlyUnlocked.push(def);
  }

  return newlyUnlocked;
}

// ---------------------------------------------------------------------------
// Get achievement definition by type
// ---------------------------------------------------------------------------

export function getAchievementDef(type: string): AchievementDef | undefined {
  return ACHIEVEMENT_DEFS.find((d) => d.type === type);
}
