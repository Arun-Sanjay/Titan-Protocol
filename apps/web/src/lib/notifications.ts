import { db, type NotificationSetting } from "./db";

// ---------------------------------------------------------------------------
// Settings CRUD
// ---------------------------------------------------------------------------

const DEFAULT_NOTIFICATIONS: NotificationSetting[] = [
  { id: "morning_checkin", enabled: true, time: "08:00" },
  { id: "evening_review", enabled: true, time: "21:00" },
  { id: "focus_reminder", enabled: false, time: "10:00" },
  { id: "habit_reminder", enabled: false, time: "09:00" },
];

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const settings = await db.notification_settings.toArray();
  if (settings.length === 0) {
    // Seed defaults
    await db.notification_settings.bulkPut(DEFAULT_NOTIFICATIONS);
    return DEFAULT_NOTIFICATIONS;
  }
  return settings;
}

export async function updateNotificationSetting(
  id: string,
  updates: Partial<Pick<NotificationSetting, "enabled" | "time">>,
): Promise<void> {
  await db.notification_settings.update(id, updates);
}

// ---------------------------------------------------------------------------
// Notification Labels
// ---------------------------------------------------------------------------

export const NOTIFICATION_LABELS: Record<string, { label: string; description: string }> = {
  morning_checkin: {
    label: "Morning Check-In",
    description: "Reminds you to plan your day and review tasks",
  },
  evening_review: {
    label: "Evening Review",
    description: "Prompts you to reflect on your day and log progress",
  },
  focus_reminder: {
    label: "Focus Reminder",
    description: "Reminds you to start a focus session",
  },
  habit_reminder: {
    label: "Habit Reminder",
    description: "Reminds you to complete your daily habits",
  },
};

// ---------------------------------------------------------------------------
// Browser / Tauri notification helpers
// ---------------------------------------------------------------------------

export async function requestPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Check if Tauri notification API is available
  if ("__TAURI__" in window) {
    try {
      const { isPermissionGranted, requestPermission: tauriRequest } = await import(
        "@tauri-apps/plugin-notification"
      );
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await tauriRequest();
        granted = permission === "granted";
      }
      return granted;
    } catch {
      // Fall through to browser API
    }
  }

  // Browser Notification API
  if ("Notification" in window) {
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  return false;
}

export async function sendNotification(title: string, body: string): Promise<void> {
  if (typeof window === "undefined") return;

  // Try Tauri first
  if ("__TAURI__" in window) {
    try {
      const { sendNotification: tauriSend } = await import(
        "@tauri-apps/plugin-notification"
      );
      tauriSend({ title, body });
      return;
    } catch {
      // Fall through
    }
  }

  // Browser Notification API
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon.png" });
  }
}

// ---------------------------------------------------------------------------
// Scheduler (simple interval-based)
// ---------------------------------------------------------------------------

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastCheckedMinute = "";

export function startNotificationScheduler(): void {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    const now = new Date();
    const currentMinute = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Only check once per minute
    if (currentMinute === lastCheckedMinute) return;
    lastCheckedMinute = currentMinute;

    const settings = await getNotificationSettings();
    for (const setting of settings) {
      if (setting.enabled && setting.time === currentMinute) {
        const info = NOTIFICATION_LABELS[setting.id];
        if (info) {
          await sendNotification(`Titan Protocol: ${info.label}`, info.description);
        }
      }
    }
  }, 30_000); // Check every 30 seconds
}

export function stopNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
