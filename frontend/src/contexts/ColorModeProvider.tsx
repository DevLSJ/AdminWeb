import { useMemo, useState, type ReactNode } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import type { PaletteMode } from '@mui/material'
import { createAppTheme } from '../theme/theme'
import { ColorModeContext, type ColorModeContextValue } from './ColorModeContext'

const THEME_STORAGE_KEY = 'theme-mode'

function readStoredMode(): PaletteMode {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(readStoredMode)
  const theme = useMemo(() => createAppTheme(mode), [mode])
  const value = useMemo<ColorModeContextValue>(() => ({
    mode,
    toggleColorMode: () => setMode((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    }),
  }), [mode])

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
