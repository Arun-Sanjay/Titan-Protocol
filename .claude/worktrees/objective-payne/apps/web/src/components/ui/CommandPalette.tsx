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
      { id: "body", label: "Go to Body", run: () => router.push("/os/body") },
      { id: "mind", label: "Go to Mind", run: () => router.push("/os/mind") },
      { id: "money", label: "Go to Money", run: () => router.push("/os/money") },
      { id: "general", label: "Go to General", run: () => router.push("/os/general") },
    ],
    [router],
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
