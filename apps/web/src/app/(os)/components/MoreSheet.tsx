"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomSheet } from "../../../components/ui/BottomSheet";
import { NavIcon } from "../../../components/ui/NavIcon";
import { playClick } from "../../../lib/sound";

type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
};

const MORE_GROUPS = [
  {
    label: "Core",
    items: [
      { href: "/os/command", label: "Command Center", icon: "command" },
      { href: "/os/analytics", label: "Analytics", icon: "analytics" },
    ],
  },
  {
    label: "Engines",
    items: [
      { href: "/os/body", label: "Body", icon: "body" },
      { href: "/os/mind", label: "Mind", icon: "mind" },
      { href: "/os/money", label: "Money", icon: "money" },
      { href: "/os/general", label: "General", icon: "general" },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/os/habits", label: "Habits", icon: "habits" },
      { href: "/os/journal", label: "Journal", icon: "journal" },
      { href: "/os/goals", label: "Goals", icon: "goals" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/os/focus", label: "Focus Timer", icon: "focus" },
      { href: "/os/body/workouts", label: "Workouts", icon: "workout" },
      { href: "/os/body/sleep", label: "Sleep Tracker", icon: "sleep" },
      { href: "/os/body/weight", label: "Weight Tracker", icon: "weight" },
      { href: "/os/body/nutrition", label: "Nutrition", icon: "nutrition" },
    ],
  },
  {
    label: "",
    items: [
      { href: "/os/settings", label: "Settings", icon: "settings" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/os") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  return (
    <BottomSheet open={open} onClose={onClose} title="Navigation">
      <nav className="tx-more-sheet-nav">
        {MORE_GROUPS.map((group) => (
          <div key={group.label || "settings"} className="tx-more-sheet-group">
            {group.label && (
              <p className="tx-more-sheet-group-label">{group.label}</p>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`tx-more-sheet-item ${active ? "is-active" : ""}`}
                  onClick={() => {
                    playClick();
                    onClose();
                  }}
                >
                  <NavIcon name={item.icon} size={18} className="tx-more-sheet-icon" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </BottomSheet>
  );
}
