/** Theme management for Titan Protocol */

export type TitanTheme = "hud" | "cyberpunk";

const STORAGE_KEY = "titan_theme";

const VALID_THEMES: TitanTheme[] = ["hud", "cyberpunk"];

export function getStoredTheme(): TitanTheme {
  if (typeof window === "undefined") return "hud";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_THEMES.includes(stored as TitanTheme)) {
    return stored as TitanTheme;
  }
  return "hud";
}

export function setStoredTheme(theme: TitanTheme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyStoredTheme(): TitanTheme {
  const theme = getStoredTheme();
  document.documentElement.setAttribute("data-theme", theme);
  return theme;
}
