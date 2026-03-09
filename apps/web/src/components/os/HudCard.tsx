import * as React from "react";

type HudCardProps = {
  title?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function HudCard({ title, rightSlot, className, children }: HudCardProps) {
  return (
    <section className={["hud-card", className ?? ""].join(" ").trim()}>
      {title || rightSlot ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="hud-card-title">{title}</h2> : <span />}
          {rightSlot}
        </div>
      ) : null}
      {children}
    </section>
  );
}
