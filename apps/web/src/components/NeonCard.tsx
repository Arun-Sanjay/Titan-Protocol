import * as React from "react";

export function NeonCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-xl border border-cyan-400/60 bg-slate-950/60 p-6",
        className ?? "",
      ].join(" ")}
      style={{
        boxShadow:
          "0 0 0 1px rgba(34,211,238,0.10), 0 0 24px rgba(34,211,238,0.12)",
      }}
    >
      {children}
    </div>
  );
}

