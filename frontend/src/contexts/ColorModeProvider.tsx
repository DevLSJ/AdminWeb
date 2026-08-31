import { useMemo, useState, type ReactNode } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import type { PaletteMode } from '@mui/material'
import { createAppTheme } from '../theme/theme'
import { ColorModeContext, type ColorModeContextValue } from './ColorModeContext'

const THEME_STORAGE_KEY = 'theme-mode'

function readStoredMode(): PaletteMode {
  // 저장값이 없거나 손상된 경우 안전한 기본값인 light 모드를 사용한다.
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(readStoredMode)
  // 모드가 바뀔 때만 MUI 테마 객체를 다시 생성한다.
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
