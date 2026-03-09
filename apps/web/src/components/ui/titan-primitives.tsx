import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type TitanPageHeaderProps = {
  kicker: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
};

export function TitanPageHeader({
  kicker,
  title,
  subtitle,
  rightSlot,
  className,
}: TitanPageHeaderProps) {
  return (
    <header className={cx("tx-page-head", className)}>
      <div>
        <p className="tx-kicker">{kicker}</p>
        <h1 className="tx-title tx-display">{title}</h1>
        {subtitle ? <p className="tx-subtitle">{subtitle}</p> : null}
      </div>
      {rightSlot ? <div className="tx-page-head-right">{rightSlot}</div> : null}
    </header>
  );
}

type TitanPanelProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div";
  tone?: "default" | "hero" | "subtle";
};

export function TitanPanel({
  as = "section",
  className,
  tone = "default",
  children,
  ...rest
}: TitanPanelProps) {
  const Component = as;
  return (
    <Component className={cx("tx-panel", `tx-panel--${tone}`, className)} {...rest}>
      {children}
    </Component>
  );
}

type TitanPanelHeaderProps = {
  kicker: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
};

export function TitanPanelHeader({ kicker, rightSlot, className }: TitanPanelHeaderProps) {
  return (
    <div className={cx("tx-panel-head", className)}>
      <p className="tx-kicker">{kicker}</p>
      {rightSlot}
    </div>
  );
}

type TitanProgressProps = {
  value: number;
  className?: string;
};

export function TitanProgress({ value, className }: TitanProgressProps) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("tx-progress", className)}>
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

type TitanButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "solid" | "ghost";
  compact?: boolean;
};

export function TitanButton({
  className,
  tone = "solid",
  compact = false,
  children,
  ...rest
}: TitanButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "tx-btn",
        tone === "ghost" ? "tx-btn--ghost" : "tx-btn--solid",
        compact ? "tx-btn--compact" : "",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type TitanActionLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  tone?: "solid" | "ghost";
  compact?: boolean;
  onClick?: () => void;
};

export function TitanActionLink({
  href,
  children,
  className,
  tone = "solid",
  compact = false,
  onClick,
}: TitanActionLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cx(
        "tx-btn tx-link-btn",
        tone === "ghost" ? "tx-btn--ghost" : "tx-btn--solid",
        compact ? "tx-btn--compact" : "",
        className,
      )}
    >
      {children}
    </Link>
  );
}

type TitanMetricProps = {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function TitanMetric({ label, value, meta, className }: TitanMetricProps) {
  return (
    <div className={cx("tx-metric", className)}>
      <p className="tx-metric-label">{label}</p>
      <p className="tx-metric-value">{value}</p>
      {meta ? <p className="tx-metric-meta">{meta}</p> : null}
    </div>
  );
}
