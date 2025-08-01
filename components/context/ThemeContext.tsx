
import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';

interface Theme {
  name: string;
  colors: {
    '--color-primary': string;
    '--color-secondary': string;
    '--color-background': string;
    '--color-surface': string;
    '--color-surface-light': string;
    '--color-text-primary': string;
    '--color-text-secondary': string;
    '--color-border': string;
  };
}

const themes: Theme[] = [
    { name: 'AIX Dark', colors: { '--color-primary': '217 70% 50%', '--color-secondary': '217 33% 84%', '--color-background': '220 13% 18%', '--color-surface': '220 13% 22%', '--color-surface-light': '220 13% 28%', '--color-text-primary': '210 20% 98%', '--color-text-secondary': '220 9% 71%', '--color-border': '220 13% 35%' } },
    { name: 'Neon Dusk', colors: { '--color-primary': '317 100% 57%', '--color-secondary': '217 33% 84%', '--color-background': '258 20% 10%', '--color-surface': '258 20% 15%', '--color-surface-light': '258 20% 20%', '--color-text-primary': '210 20% 98%', '--color-text-secondary': '220 9% 71%', '--color-border': '258 20% 25%' } },
    { name: 'Forest', colors: { '--color-primary': '142 76% 36%', '--color-secondary': '142 20% 80%', '--color-background': '120 20% 15%', '--color-surface': '120 20% 20%', '--color-surface-light': '120 20% 25%', '--color-text-primary': '120 10% 95%', '--color-text-secondary': '120 5% 70%', '--color-border': '120 10% 30%' } },
    { name: 'Oceanic', colors: { '--color-primary': '205 90% 55%', '--color-secondary': '205 30% 85%', '--color-background': '210 30% 12%', '--color-surface': '210 30% 18%', '--color-surface-light': '210 30% 24%', '--color-text-primary': '210 15% 95%', '--color-text-secondary': '210 10% 70%', '--color-border': '210 20% 30%' } },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(themes[0]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, availableThemes: themes }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
