import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d92f81',
      light: '#f3d4e5',
      dark: '#a91d61',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7652b8',
    },
    background: {
      default: '#f6f7fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#202534',
      secondary: '#7a8090',
    },
    divider: '#eceef4',
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
    borderRadius: 12,
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
        root: {
          border: '1px solid #eef0f5',
          boxShadow: '0 8px 30px rgba(31, 38, 54, 0.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 9,
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
          paddingTop: 14,
          paddingBottom: 14,
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
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
  },
})

export default theme
