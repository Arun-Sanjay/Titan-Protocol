"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageTransition } from "../../../components/ui/PageTransition";
import { CommandPalette } from "../../../components/ui/CommandPalette";
import { playClick } from "../../../lib/sound";

const NAV_ITEMS = [
  { href: "/os", label: "Dashboard", icon: "⌂" },
  { href: "/os/command", label: "Command Center", icon: "▣" },
  { href: "/os/analytics", label: "Analytics", icon: "◫" },
  { href: "/os/body", label: "Body", icon: "◈" },
  { href: "/os/mind", label: "Mind", icon: "◎" },
  { href: "/os/money", label: "Money", icon: "◍" },
  { href: "/os/general", label: "General", icon: "△" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/os") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OSShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  function handleNavClick() {
    playClick();
  }

  function renderNavItems() {
    return NAV_ITEMS.map((item) => {
      const active = isActive(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={handleNavClick}
          className={["tp-nav-item", active ? "is-active" : ""].join(" ")}
        >
          <span className="tp-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      );
    });
  }

  return (
    <div className="tp-os-shell">
      <CommandPalette />

      <aside className="tp-nav tp-nav-desktop hidden lg:flex lg:flex-col">
        <div className="tp-nav-header">
          <p className="tp-nav-title">Titan OS</p>
          <p className="tp-nav-sub">Navigation</p>
        </div>
        <nav className="tp-nav-list">{renderNavItems()}</nav>
      </aside>

      <div className="tp-main min-w-0">
        <PageTransition>
          <div className="min-w-0">{children}</div>
        </PageTransition>
      </div>
    </div>
  );
}
