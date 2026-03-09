"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";

import { playClick } from "../../lib/sound";

type CommandAction = {
  id: string;
  label: string;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const actions = React.useMemo<CommandAction[]>(
    () => [
      { id: "dashboard", label: "Go to Dashboard", run: () => router.push("/os") },
      { id: "analytics", label: "Go to Analytics", run: () => router.push("/os/analytics") },
      { id: "command", label: "Go to Command Center", run: () => router.push("/os/command") },
      { id: "focus", label: "Go to Focus Timer", run: () => router.push("/os/focus") },
      { id: "body", label: "Go to Body", run: () => router.push("/os/body") },
      { id: "workouts", label: "Go to Workouts", run: () => router.push("/os/body/workouts") },
      { id: "weight", label: "Go to Weight Tracker", run: () => router.push("/os/body/weight") },
      { id: "nutrition", label: "Go to Nutrition", run: () => router.push("/os/body/nutrition") },
      { id: "sleep", label: "Go to Sleep Tracker", run: () => router.push("/os/body/sleep") },
      { id: "mind", label: "Go to Mind", run: () => router.push("/os/mind") },
      { id: "money", label: "Go to Money", run: () => router.push("/os/money") },
      { id: "deep-work", label: "Go to Deep Work", run: () => router.push("/os/money/deep-work") },
      { id: "budgets", label: "Go to Budgets", run: () => router.push("/os/money/budgets") },
      { id: "general", label: "Go to General", run: () => router.push("/os/general") },
      { id: "habits", label: "Go to Habits", run: () => router.push("/os/habits") },
      { id: "journal", label: "Go to Journal", run: () => router.push("/os/journal") },
      { id: "goals", label: "Go to Goals", run: () => router.push("/os/goals") },
      { id: "settings", label: "Go to Settings", run: () => router.push("/os/settings") },
    ],
    [router],
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
      if (
        event.key.toLowerCase() === "f" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey
      ) {
        event.preventDefault();
        router.push("/os/focus");
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  function runAction(action: CommandAction) {
    playClick();
    action.run();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 pt-[12vh]">
      <Command
        label="Titan OS Command Palette"
        className="hud-panel w-full max-w-xl overflow-hidden rounded-md border border-white/20 bg-black/90 shadow-none"
      >
        <Command.Input
          autoFocus
          placeholder="Type a command..."
          className="w-full border-b border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/45"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-2 text-sm text-white/50">No results found.</Command.Empty>
          <Command.Group heading="Navigation">
            {actions.map((action) => (
              <Command.Item
                key={action.id}
                onSelect={() => runAction(action)}
                className="cursor-pointer rounded-sm px-3 py-2 text-sm text-white/85 outline-none transition hover:bg-white/8 data-[selected=true]:bg-white/12"
              >
                {action.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
