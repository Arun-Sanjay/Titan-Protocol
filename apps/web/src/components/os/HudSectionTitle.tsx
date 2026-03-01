import type { ReactNode } from "react";

export function HudSectionTitle({ children }: { children: ReactNode }) {
  return <p className="hud-section-title">{children}</p>;
}
