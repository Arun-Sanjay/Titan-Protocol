import type { ReactNode } from "react";

export function HudPill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={["hud-pill px-2 py-1 text-xs uppercase tracking-[0.14em]", className].join(" ")}>{children}</span>;
}
