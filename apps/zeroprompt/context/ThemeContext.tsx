import React, { createContext, useContext, useState } from "react";
import { THEMES, ThemeType } from "../constants/theme";

type ThemeContextType = {
  theme: ThemeType;
  setThemeId: (id: string) => void;
  availableThemes: typeof THEMES;
};

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeType>(THEMES.DARK_DEFAULT);

  const setThemeId = (id: string) => {
    const found = Object.values(THEMES).find(t => t.id === id);
    if (found) setTheme(found);
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, availableThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
