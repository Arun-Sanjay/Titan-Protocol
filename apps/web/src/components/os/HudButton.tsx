import type { ButtonHTMLAttributes } from "react";

type HudButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export function HudButton({ className = "", type = "button", ...props }: HudButtonProps) {
  return <button type={type} className={["hud-btn", className].join(" ").trim()} {...props} />;
}
