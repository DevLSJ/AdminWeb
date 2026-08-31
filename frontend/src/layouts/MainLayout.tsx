import { useState, type ReactNode } from 'react'
import {
  AccountCircleRounded,
  AddBoxRounded,
  Brightness4Rounded,
  Brightness7Rounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  DashboardRounded,
  DescriptionRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
  KeyRounded,
  ListAltRounded,
  LogoutRounded,
  MenuRounded,
  PeopleAltRounded,
  RefreshRounded,
  ScienceRounded,
  SecurityRounded,
} from '@mui/icons-material'
import {
  AppBar,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useColorMode } from '../contexts/ColorModeContext'
import { useAuth } from '../hooks/useAuth'
import { useAuthTimer } from '../hooks/useAuthTimer'
import type { UserRole } from '../types/auth'

const expandedWidth = 260
const collapsedWidth = 88

interface MenuChild {
  label: string
  path: string
  icon: ReactNode
  roles: UserRole[]
}

interface MenuGroup {
  id: string
  label: string
  icon: ReactNode
  roles: UserRole[]
  path?: string
  children?: MenuChild[]
}

const menuGroups: MenuGroup[] = [
  { id: 'dashboard', label: '대시보드', path: '/', icon: <DashboardRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'] },
  {
    id: 'keys', label: '키 관리', icon: <KeyRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'], children: [
      { label: '키 목록', path: '/keys', icon: <ListAltRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'] },
      { label: '암복호화 테스트', path: '/keys/test', icon: <ScienceRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'] },
    ],
  },
  { id: 'users', label: '사용자 관리', path: '/users', icon: <PeopleAltRounded />, roles: ['S.ADMIN', 'ADMIN'] },
  { id: 'audit', label: '감사 로그', path: '/audit-logs', icon: <SecurityRounded />, roles: ['S.ADMIN', 'ADMIN'] },
  {
    id: 'notices', label: '게시판', icon: <DescriptionRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'], children: [
      { label: '공지사항 목록', path: '/notices', icon: <ListAltRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'] },
      { label: '공지사항 등록', path: '/notices/new', icon: <AddBoxRounded />, roles: ['S.ADMIN', 'ADMIN', 'CLIENT'] },
    ],
  },
]

const pageTitles: Array<[string, string]> = [
  ['/keys/test', '암복호화 테스트'], ['/keys/', '키 상세'],
  ['/keys', '키 목록'], ['/users', '사용자 관리'], ['/audit-logs', '감사 로그'],
  ['/my/recent-activity', '내 최근 활동'],
  ['/notices/new', '공지사항 등록'], ['/notices', '공지사항'], ['/', '대시보드'],
  ['/profile', '프로필 관리'], ['/forbidden', '접근 제한'],
]

function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ keys: true, notices: true })
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, logout, refreshSession, expireSession } = useAuth()
  const { mode, toggleColorMode } = useColorMode()
  const { formattedTime, remainingSeconds } = useAuthTimer(token, expireSession)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null)
  const drawerWidth = collapsed ? collapsedWidth : expandedWidth
  const currentTitle = pageTitles.find(([path]) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path))?.[1] ?? 'D\'Guard KMS'

  const handleNavigate = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  const toggleGroup = (id: string) => {
    if (collapsed) setCollapsed(false)
    setOpenGroups((current) => ({ ...current, [id]: !current[id] }))
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleRefreshSession = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    const result = await refreshSession()
    setFeedback({ severity: result.success ? 'success' : 'error', message: result.message })
    setIsRefreshing(false)
  }

  if (!user) return null

  // 메뉴 필터는 UX용이며 실제 접근 권한은 라우트 가드와 백엔드 인가가 최종 판단한다.
  const visibleMenuGroups = menuGroups
    .filter((group) => group.roles.includes(user.role))
    .map((group) => ({ ...group, children: group.children?.filter((child) => child.roles.includes(user.role)) }))

  const renderDrawer = (mobile = false) => {
    const showText = mobile || !collapsed

    return (
      <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column', overflowX: 'hidden' }}>
        <Box sx={{ display: 'flex', minHeight: 72, alignItems: 'center', justifyContent: showText ? 'flex-start' : 'center', px: showText ? 2.5 : 0, background: 'linear-gradient(125deg, #e72f7e 0%, #9d4cc5 100%)', color: 'common.white' }}>
          <Box sx={{ display: 'grid', width: 36, height: 36, flexShrink: 0, placeItems: 'center', borderRadius: '10px', bgcolor: alpha('#ffffff', 0.2) }}><KeyRounded sx={{ fontSize: 21 }} /></Box>
          {showText && <Box sx={{ ml: 1.3, whiteSpace: 'nowrap' }}><Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>D&apos;Guard KMS</Typography><Typography sx={{ mt: 0.4, fontSize: 12.5, lineHeight: 1.4, opacity: 0.85 }}>Key Management System</Typography></Box>}
        </Box>

        <Box sx={{ px: showText ? 1.5 : 1, py: 2.5 }}>
          {showText && <Typography sx={{ mb: 1.2, px: 1.5, color: 'text.secondary', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em' }}>MANAGEMENT</Typography>}
          <List disablePadding>
            {visibleMenuGroups.map((group) => {
              const groupSelected = group.path ? location.pathname === group.path : group.children?.some((child) => location.pathname === child.path || (child.path === '/keys' && location.pathname.startsWith('/keys/'))) ?? false
              const groupOpen = Boolean(openGroups[group.id])
              const button = (
                <ListItemButton
                  selected={groupSelected && (!group.children || collapsed)}
                  onClick={() => group.children ? toggleGroup(group.id) : group.path && handleNavigate(group.path)}
                  sx={{ minHeight: 50, justifyContent: showText ? 'initial' : 'center', borderRadius: 2.5, px: showText ? 1.5 : 0, color: groupSelected ? 'primary.main' : 'text.secondary', '&.Mui-selected': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09) } }}
                >
                  <ListItemIcon sx={{ minWidth: showText ? 40 : 0, justifyContent: 'center', color: 'inherit', '& .MuiSvgIcon-root': { fontSize: 22 } }}>{group.icon}</ListItemIcon>
                  {showText && <ListItemText primary={group.label} slotProps={{ primary: { sx: { fontSize: 15, fontWeight: groupSelected ? 700 : 600 } } }} />}
                  {showText && group.children && (groupOpen ? <ExpandLessRounded /> : <ExpandMoreRounded />)}
                </ListItemButton>
              )

              return (
                <Box key={group.id} sx={{ mb: 0.6 }}>
                  <Tooltip title={!showText ? group.label : ''} placement="right"><ListItem disablePadding>{button}</ListItem></Tooltip>
                  {group.children && showText && <Collapse in={groupOpen} timeout="auto" unmountOnExit><List disablePadding sx={{ mt: 0.4 }}>{group.children.map((child) => {
                    const isKeyDetail = child.path === '/keys'
                      && /^\/keys\/[^/]+$/.test(location.pathname)
                      && location.pathname !== '/keys/test'
                    const selected = location.pathname === child.path || isKeyDetail
                    return <ListItem key={child.path} disablePadding><ListItemButton selected={selected} onClick={() => handleNavigate(child.path)} sx={{ minHeight: 44, ml: 1.3, pl: 2.4, borderRadius: 2, color: selected ? 'primary.main' : 'text.secondary', '&.Mui-selected': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) } }}><ListItemIcon sx={{ minWidth: 34, color: 'inherit', '& .MuiSvgIcon-root': { fontSize: 19 } }}>{child.icon}</ListItemIcon><ListItemText primary={child.label} slotProps={{ primary: { sx: { fontSize: 14.5, lineHeight: 1.5, fontWeight: selected ? 700 : 500 } } }} /></ListItemButton></ListItem>
                  })}</List></Collapse>}
                </Box>
              )
            })}
          </List>
        </Box>

        <Box sx={{ mt: 'auto', p: showText ? 2 : 1 }}>
          <Divider sx={{ mb: 2 }} />
          <Tooltip title={!showText ? `${user.loginId} · 프로필 관리` : ''} placement="right">
            <Box role="button" tabIndex={0} onClick={() => handleNavigate('/profile')} onKeyDown={(event) => { if (event.key === 'Enter') handleNavigate('/profile') }} sx={{ display: 'flex', alignItems: 'center', justifyContent: showText ? 'flex-start' : 'center', px: showText ? 1 : 0, py: 0.75, borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
              <Avatar sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}><AccountCircleRounded /></Avatar>
              {showText && <Box sx={{ ml: 1.25 }}><Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>{user.loginId}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 12.5, lineHeight: 1.5 }}>{user.name} · {user.role}</Typography></Box>}
            </Box>
          </Tooltip>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, transition: (theme) => theme.transitions.create(['width', 'margin-left']), borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94), color: 'text.primary', backdropFilter: 'blur(12px)' }}>
        <Toolbar sx={{ minHeight: '72px !important', px: { xs: 2, sm: 3.5 } }}>
          <Tooltip title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}><IconButton aria-label="사이드바 토글" onClick={() => setCollapsed((value) => !value)} sx={{ display: { xs: 'none', md: 'inline-flex' }, mr: 1.5 }}>{collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}</IconButton></Tooltip>
          <IconButton aria-label="메뉴 열기" onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' }, mr: 1 }}><MenuRounded /></IconButton>
          <Typography sx={{ flexGrow: 1, fontSize: 18, fontWeight: 700 }}>{currentTitle}</Typography>
          <Stack direction="row" spacing={{ xs: 0.25, sm: 0.75 }} sx={{ alignItems: 'center' }}>
            <Button color="inherit" onClick={() => navigate('/profile')} sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0, mr: 0.5, p: 0.5, textAlign: 'right' }}><Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>{user.loginId}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>{user.role}</Typography></Button>
            <Tooltip title={mode === 'dark' ? '라이트 모드' : '다크 모드'}>
              <IconButton aria-label={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} color="inherit" onClick={toggleColorMode}>{mode === 'dark' ? <Brightness7Rounded /> : <Brightness4Rounded />}</IconButton>
            </Tooltip>
            <Chip
              aria-label={`세션 남은 시간 ${formattedTime}`}
              label={formattedTime}
              color={remainingSeconds <= 60 ? 'error' : remainingSeconds <= 300 ? 'warning' : 'default'}
              size="small"
              variant={remainingSeconds <= 300 ? 'filled' : 'outlined'}
              sx={{ minWidth: 66, fontVariantNumeric: 'tabular-nums', '& .MuiChip-label': { px: 1 } }}
            />
            <Tooltip title="세션 연장">
              <span><IconButton aria-label="세션 연장" color="inherit" disabled={isRefreshing} onClick={() => void handleRefreshSession()} size="small"><RefreshRounded sx={{ animation: isRefreshing ? 'session-spin 0.8s linear infinite' : 'none', '@keyframes session-spin': { to: { transform: 'rotate(360deg)' } } }} /></IconButton></span>
            </Tooltip>
            <Tooltip title="로그아웃">
              <IconButton aria-label="로그아웃" color="inherit" onClick={handleLogout}><LogoutRounded /></IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, transition: (theme) => theme.transitions.create('width') }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: expandedWidth, border: 0 } }}>{renderDrawer(true)}</Drawer>
        <Drawer variant="permanent" open sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, overflowX: 'hidden', transition: (theme) => theme.transitions.create('width'), borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' } }}>{renderDrawer()}</Drawer>
      </Box>

      <Box component="main" sx={{ width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` }, minHeight: '100vh', pt: '72px', transition: (theme) => theme.transitions.create('width') }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 'none',
            minHeight: 'calc(100vh - 72px)',
            mx: 'auto',
            p: { xs: 2, sm: 2.5 },
          }}
        >
          <Box key={location.pathname} className="page-route-transition">
            <Outlet />
          </Box>
        </Box>
      </Box>
      <Snackbar open={Boolean(feedback)} autoHideDuration={3500} onClose={() => setFeedback(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={feedback?.severity ?? 'success'} variant="filled" onClose={() => setFeedback(null)}>{feedback?.message}</Alert>
      </Snackbar>
    </Box>
  )
}

export default MainLayout
