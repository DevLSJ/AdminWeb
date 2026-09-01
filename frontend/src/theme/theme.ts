import { createTheme, type PaletteMode } from '@mui/material/styles'

export const createAppTheme = (mode: PaletteMode) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#1769e8',
      light: '#dce9ff',
      dark: '#0d47b8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#315bd8',
    },
    background: mode === 'light'
      ? { default: '#f6f7fb', paper: '#ffffff' }
      : { default: '#11131a', paper: '#1b1e28' },
    text: mode === 'light'
      ? { primary: '#202534', secondary: '#7a8090' }
      : { primary: '#f2f3f7', secondary: '#aeb3c2' },
    divider: mode === 'light' ? '#eceef4' : '#303442',
    success: {
      main: '#25b884',
    },
    warning: {
      main: '#f5a623',
    },
    error: {
      main: '#e4516f',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontSize: '1.9rem',
      fontWeight: 700,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontSize: '1.65rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h6: {
      fontSize: '1.12rem',
      fontWeight: 700,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.65,
    },
    body2: {
      fontSize: '0.925rem',
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: mode === 'light'
            ? '0 10px 32px rgba(39, 76, 142, 0.07)'
            : '0 8px 30px rgba(0, 0, 0, 0.22)',
        }),
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.9rem',
          lineHeight: 1.5,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.875rem',
          lineHeight: 1.55,
          paddingTop: 9,
          paddingBottom: 9,
        },
        head: {
          fontSize: '0.875rem',
          fontWeight: 750,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: '0.9rem', lineHeight: 1.55 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.9rem' },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '0.8rem', lineHeight: 1.5 },
      },
    },
    MuiChip: {
      styleOverrides: {
        label: { fontSize: '0.78rem', fontWeight: 650 },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: '1.15rem', fontWeight: 750 },
      },
    },
    MuiDialog: {
      defaultProps: {
        slotProps: {
          backdrop: {
            sx: {
              backgroundColor: 'rgba(15, 18, 28, 0.5)',
              backdropFilter: 'blur(9px)',
            },
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 42,
          backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.86)' : 'rgba(27,30,40,0.86)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 42, paddingTop: 8, paddingBottom: 8 },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
  },
})

export default createAppTheme
