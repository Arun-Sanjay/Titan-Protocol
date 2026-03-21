"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "../../../components/ui/NavIcon";
import { playClick } from "../../../lib/sound";
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
  if (href === "/os") return pathname === "/os" || pathname === "/os/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Close drawer on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!isMobile) return null;

  return (
    <>
      {/* ── Fixed Top Header Bar ── */}
      <header className="tx-mobile-header">
        <button
          type="button"
          className="tx-mobile-hamburger"
          onClick={() => {
            playClick();
            setOpen(true);
          }}
          aria-label="Open navigation"
        >
          <span className="tx-hamburger-line" />
          <span className="tx-hamburger-line" />
          <span className="tx-hamburger-line" />
        </button>
        <p className="tx-mobile-header-title">Titan OS</p>
        <div className="tx-mobile-header-spacer" />
      </header>

      {/* ── Slide-in Drawer ── */}
      <div
        className={`tx-mobile-drawer-backdrop ${open ? "is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <nav
        className={`tx-mobile-drawer ${open ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        {/* Drawer Header */}
        <div className="tx-drawer-header">
          <div className="tx-drawer-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12,2 22,10 18,22 6,22 2,10" />
              <line x1="2" y1="10" x2="22" y2="10" strokeOpacity="0.45" />
              <line x1="6" y1="22" x2="12" y2="2" strokeOpacity="0.45" />
              <line x1="18" y1="22" x2="12" y2="2" strokeOpacity="0.45" />
            </svg>
            <span>Titan Protocol</span>
          </div>
          <button
            type="button"
            className="tx-drawer-close"
            onClick={() => {
              playClick();
              setOpen(false);
            }}
            aria-label="Close navigation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="tx-drawer-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="tx-drawer-group">
              <p className="tx-drawer-group-label">{group.label}</p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`tx-drawer-item ${active ? "is-active" : ""}`}
                    onClick={() => {
                      playClick();
                      setOpen(false);
                    }}
                  >
                    <NavIcon name={item.icon} size={18} className="tx-drawer-icon" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Settings at bottom */}
          <div className="tx-drawer-group tx-drawer-settings">
            <Link
              href="/os/settings"
              className={`tx-drawer-item ${isActive(pathname, "/os/settings") ? "is-active" : ""}`}
              onClick={() => {
                playClick();
                setOpen(false);
              }}
            >
              <NavIcon name="settings" size={18} className="tx-drawer-icon" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
