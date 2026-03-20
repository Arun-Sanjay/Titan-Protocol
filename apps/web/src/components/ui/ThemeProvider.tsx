"use client";

import * as React from "react";
import {
  type TitanTheme,
  getStoredTheme,
  setStoredTheme,
  applyStoredTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: TitanTheme;
  setTheme: (t: TitanTheme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "hud",
  setTheme: () => {},
});

export function useTheme() {
  return React.useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<TitanTheme>("hud");

  React.useEffect(() => {
    const applied = applyStoredTheme();
    setThemeState(applied);
  }, []);

  const setTheme = React.useCallback((t: TitanTheme) => {
    setStoredTheme(t);
    setThemeState(t);
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
