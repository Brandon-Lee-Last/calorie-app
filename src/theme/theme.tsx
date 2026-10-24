import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { dark, light, type Palette } from './tokens';

export type Scheme = 'dark' | 'light';
export type Theme = { scheme: Scheme; colors: Palette };

const ThemeContext = createContext<Theme>({ scheme: 'dark', colors: dark });

/** Dark first. Light when the phone is set to light, or when `scheme` forces it. */
export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const active: Scheme = scheme ?? (system === 'light' ? 'light' : 'dark');
  const value = useMemo<Theme>(() => ({ scheme: active, colors: active === 'light' ? light : dark }), [active]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
