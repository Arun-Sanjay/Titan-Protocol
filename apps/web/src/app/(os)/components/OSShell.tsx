"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageTransition } from "../../../components/ui/PageTransition";
import { CommandPalette } from "../../../components/ui/CommandPalette";
import { playClick } from "../../../lib/sound";

const NAV_ITEMS = [
  { href: "/os", label: "Dashboard", icon: "⌂" },
  { href: "/os/body", label: "Body", icon: "◈" },
  { href: "/os/mind", label: "Mind", icon: "◎" },
  { href: "/os/money", label: "Money", icon: "◍" },
  { href: "/os/general", label: "General", icon: "△" },
] as const;

const PAGE_TITLES: Array<{ match: string; title: string }> = [
  { match: "/os/debug/cycles", title: "Debug • Cycles" },
  { match: "/os/body/nutrition", title: "Body • Nutrition" },
  { match: "/os/body/gym", title: "Body • Gym" },
  { match: "/os/mind/focus", title: "Mind • Focus Timer" },
  { match: "/os/money/skill", title: "Money • Skill Tracker" },
  { match: "/os/body", title: "Body • Today" },
  { match: "/os/mind", title: "Mind • Today" },
  { match: "/os/money", title: "Money • Today" },
  { match: "/os/general", title: "General • Today" },
  { match: "/os", title: "Dashboard" },
];

function getPageTitle(pathname: string): string {
  return PAGE_TITLES.find((item) => pathname.startsWith(item.match))?.title ?? "Titan Protocol OS";
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/os") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OSShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(false);
  const pageTitle = getPageTitle(pathname);
  const navItems = NAV_ITEMS;
  const mobileItems = NAV_ITEMS;

  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  function handleNavClick() {
    playClick();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-4 px-3 py-3 pb-20 lg:px-5 lg:pb-3">
      <CommandPalette />
      <div
        className={[
          "fixed inset-0 z-40 bg-black/55 transition-opacity lg:hidden",
          isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={[
          "hud-panel fixed inset-y-3 left-3 z-50 w-72 max-w-[calc(100vw-1.5rem)] p-4 transition-transform lg:sticky lg:top-4 lg:z-auto lg:h-[calc(100vh-2rem)] lg:w-72 lg:max-w-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="hud-title text-lg">Titan OS</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/50">Navigation</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="hud-btn px-3 py-1.5 text-xs text-white lg:hidden"
          >
            Close
          </button>
        </div>

        <nav className="mt-5 grid gap-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={[
                  "hud-btn flex items-center gap-3 px-3 py-2 text-sm text-white transition-colors",
                  active ? "border-white/45 bg-white/12" : "text-white/75",
                ].join(" ")}
              >
                <span className="text-xs text-white/60">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 lg:pl-0">
        <header className="hud-panel mb-4 flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="hud-btn px-3 py-1.5 text-sm text-white lg:hidden"
            >
              Menu
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">OS Home</p>
              <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
            </div>
          </div>

        </header>

        <PageTransition>
          <div className="min-w-0">{children}</div>
        </PageTransition>
      </div>

      <nav className="hud-panel fixed bottom-2 left-2 right-2 z-30 grid grid-cols-5 gap-1 p-2 lg:hidden">
        {mobileItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              onClick={handleNavClick}
              className={[
                "hud-btn flex flex-col items-center gap-1 px-2 py-2 text-[10px]",
                active ? "border-white/45 bg-white/12 text-white" : "text-white/70",
              ].join(" ")}
            >
              <span className="text-xs">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
