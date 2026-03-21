"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PageTransition } from "../../../components/ui/PageTransition";
import { CommandPalette } from "../../../components/ui/CommandPalette";
import { NavIcon } from "../../../components/ui/NavIcon";
import { playClick } from "../../../lib/sound";
import OnboardingWizard, { useOnboarding } from "../../../components/onboarding/OnboardingWizard";
import { useTheme } from "../../../components/ui/ThemeProvider";
import { CyberTicker } from "./CyberTicker";
import { BottomNav } from "./BottomNav";
import { MoreSheet } from "./MoreSheet";
import { useIsMobile } from "../../../hooks/useIsMobile";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Core",
    items: [
      { href: "/os", label: "Dashboard", icon: "dashboard" },
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
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/os") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OSShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const {
    isComplete: onboardingComplete,
    markComplete: markOnboardingComplete,
    reset: resetOnboarding,
  } = useOnboarding();
  const [moreSheetOpen, setMoreSheetOpen] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "1") {
      resetOnboarding();
      params.delete("onboarding");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, [resetOnboarding]);

  function handleNavClick() {
    playClick();
  }

  function renderNavGroups() {
    return NAV_GROUPS.map((group, gi) => (
      <div key={group.label} className={gi > 0 ? "tp-nav-group" : undefined}>
        {gi > 0 && <div className="tp-nav-divider" />}
        <p className="tp-nav-group-label">{group.label}</p>
        {group.items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={["tp-nav-item", active ? "is-active" : ""].join(" ")}
            >
              <NavIcon name={item.icon} size={15} className="tp-nav-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    ));
  }

  return (
    <div className="tp-os-shell">
      {!onboardingComplete && (
        <OnboardingWizard onComplete={markOnboardingComplete} />
      )}
      <CommandPalette />

      {/* Bottom nav handles mobile navigation */}

      {/* Desktop sidebar */}
      <aside className="tp-nav tp-nav-desktop hidden sm:flex sm:flex-col">
        <div className="tp-nav-header">
          <div className="tp-nav-brand">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" className="tp-nav-logo">
              <polygon points="12,2 22,10 18,22 6,22 2,10" />
              <line x1="2" y1="10" x2="22" y2="10" strokeOpacity="0.45" />
              <line x1="6" y1="22" x2="12" y2="2" strokeOpacity="0.45" />
              <line x1="18" y1="22" x2="12" y2="2" strokeOpacity="0.45" />
            </svg>
            <p className="tp-nav-title">Titan OS</p>
          </div>
        </div>
        <nav className="tp-nav-list tp-nav-scrollable tp-nav-list-grow">{renderNavGroups()}</nav>
        <div className="tp-nav-bottom">
          <Link
            href="/os/settings"
            onClick={handleNavClick}
            className={["tp-nav-item", isActive(pathname, "/os/settings") ? "is-active" : ""].join(" ")}
          >
            <NavIcon name="settings" size={15} className="tp-nav-icon" />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      <div className={`tp-main min-w-0 ${isMobile ? "tp-main--mobile" : ""}`} style={isMobile ? { overflowX: 'hidden' } : undefined}>
        <PageTransition>
          <div className="min-w-0">{children}</div>
        </PageTransition>
      </div>

      {theme === "cyberpunk" && <CyberTicker />}
      <BottomNav onMorePress={() => setMoreSheetOpen(true)} />
      <MoreSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} />
    </div>
  );
}
