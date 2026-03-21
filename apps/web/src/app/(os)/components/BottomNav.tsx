"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "../../../components/ui/NavIcon";
import { playClick } from "../../../lib/sound";
import { useIsMobile } from "../../../hooks/useIsMobile";

type BottomTab = {
  id: string;
  href?: string;
  icon: string;
  label: string;
  matchPrefix?: string[];
  action?: "openSheet";
};

const BOTTOM_TABS: BottomTab[] = [
  { id: "dash", href: "/os", icon: "dashboard", label: "Dashboard" },
  {
    id: "engines",
    href: "/os/body",
    icon: "body",
    label: "Engines",
    matchPrefix: ["/os/body", "/os/mind", "/os/money", "/os/general"],
  },
  {
    id: "track",
    href: "/os/habits",
    icon: "habits",
    label: "Track",
    matchPrefix: ["/os/habits", "/os/journal", "/os/goals"],
  },
  { id: "focus", href: "/os/focus", icon: "focus", label: "Focus" },
  { id: "more", icon: "settings", label: "More", action: "openSheet" },
];

function getActiveTab(pathname: string): string | null {
  // Normalize trailing slash (Android WebView may add one)
  const normalizedPath =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

  for (const tab of BOTTOM_TABS) {
    if (tab.matchPrefix) {
      if (
        tab.matchPrefix.some(
          (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
        )
      ) {
        return tab.id;
      }
    } else if (tab.href) {
      if (
        tab.href === "/os"
          ? normalizedPath === "/os"
          : normalizedPath.startsWith(tab.href)
      ) {
        return tab.id;
      }
    }
  }
  // Return null instead of "more" — no tab highlighted for pages
  // only reachable via More sheet (analytics, command, settings, etc.)
  return null;
}

type BottomNavProps = {
  onMorePress: () => void;
};

export function BottomNav({ onMorePress }: BottomNavProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const activeTab = getActiveTab(pathname);

  if (!isMobile) return null;

  // CSS-based indicator: calculate position from active tab index
  const activeIndex = BOTTOM_TABS.findIndex((t) => t.id === activeTab);

  return (
    <nav className="tx-bottom-nav" aria-label="Main navigation">
      {/* Single indicator div positioned at nav level for reliable alignment */}
      {activeTab !== null && activeIndex >= 0 && (
        <div
          className="tx-bottom-nav-indicator"
          style={{
            left: `${(activeIndex + 0.5) * 20}%`,
            transform: "translateX(-50%)",
            transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}
      {BOTTOM_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const content = (
          <div className="tx-bottom-nav-tab-inner">
            <NavIcon
              name={tab.icon}
              size={20}
              className={`tx-bottom-nav-icon ${isActive ? "is-active" : ""}`}
            />
            <span
              className={`tx-bottom-nav-label ${isActive ? "is-active" : ""}`}
            >
              {tab.label}
            </span>
          </div>
        );

        if (tab.action === "openSheet") {
          return (
            <button
              key={tab.id}
              type="button"
              className={`tx-bottom-nav-tab ${isActive ? "is-active" : ""}`}
              onClick={() => {
                playClick();
                onMorePress();
              }}
              aria-label={tab.label}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={tab.id}
            href={tab.href!}
            className={`tx-bottom-nav-tab ${isActive ? "is-active" : ""}`}
            onClick={playClick}
            aria-label={tab.label}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
