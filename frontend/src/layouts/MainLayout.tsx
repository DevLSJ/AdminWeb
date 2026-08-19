import { useState, type ReactNode } from 'react'
import {
  AccountCircleRounded,
  AddBoxRounded,
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
  ScienceRounded,
  SecurityRounded,
} from '@mui/icons-material'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const expandedWidth = 260
const collapsedWidth = 88

interface MenuChild {
  label: string
  path: string
  icon: ReactNode
}

interface MenuGroup {
  id: string
  label: string
  icon: ReactNode
  path?: string
  children?: MenuChild[]
}

const menuGroups: MenuGroup[] = [
  { id: 'dashboard', label: '대시보드', path: '/', icon: <DashboardRounded /> },
  {
    id: 'keys', label: '키 관리', icon: <KeyRounded />, children: [
      { label: '키 목록', path: '/keys', icon: <ListAltRounded /> },
      { label: '키 등록', path: '/keys/register', icon: <AddBoxRounded /> },
      { label: '암복호화 테스트', path: '/keys/test', icon: <ScienceRounded /> },
    ],
  },
  { id: 'users', label: '사용자 관리', path: '/users', icon: <PeopleAltRounded /> },
  { id: 'audit', label: '감사 로그', path: '/audit-logs', icon: <SecurityRounded /> },
  {
    id: 'notices', label: '게시판', icon: <DescriptionRounded />, children: [
      { label: '공지사항 목록', path: '/notices', icon: <ListAltRounded /> },
      { label: '공지사항 등록', path: '/notices/new', icon: <AddBoxRounded /> },
    ],
  },
]

const pageTitles: Array<[string, string]> = [
  ['/keys/register', '키 등록'], ['/keys/test', '암복호화 테스트'], ['/keys/', '키 상세'],
  ['/keys', '키 목록'], ['/users', '사용자 관리'], ['/audit-logs', '감사 로그'],
  ['/notices/new', '공지사항 등록'], ['/notices', '공지사항'], ['/', '대시보드'],
]

interface MainLayoutProps {
  onLogout: () => void
}

function MainLayout({ onLogout }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ keys: true, notices: true })
  const location = useLocation()
  const navigate = useNavigate()
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
    onLogout()
    navigate('/login', { replace: true })
  }

  const renderDrawer = (mobile = false) => {
    const showText = mobile || !collapsed

    return (
      <Box sx={{ display: 'flex', height: '100%', flexDirection: 'column', overflowX: 'hidden' }}>
        <Box sx={{ display: 'flex', minHeight: 72, alignItems: 'center', justifyContent: showText ? 'flex-start' : 'center', px: showText ? 2.5 : 0, background: 'linear-gradient(125deg, #e72f7e 0%, #9d4cc5 100%)', color: 'common.white' }}>
          <Box sx={{ display: 'grid', width: 36, height: 36, flexShrink: 0, placeItems: 'center', borderRadius: '10px', bgcolor: alpha('#ffffff', 0.2) }}><KeyRounded sx={{ fontSize: 21 }} /></Box>
          {showText && <Box sx={{ ml: 1.3, whiteSpace: 'nowrap' }}><Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>D&apos;Guard KMS</Typography><Typography sx={{ mt: 0.4, fontSize: 11.5, opacity: 0.8 }}>Key Management System</Typography></Box>}
        </Box>

        <Box sx={{ px: showText ? 1.5 : 1, py: 2.5 }}>
          {showText && <Typography sx={{ mb: 1.2, px: 1.5, color: 'text.secondary', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>MANAGEMENT</Typography>}
          <List disablePadding>
            {menuGroups.map((group) => {
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
                      && !['/keys/register', '/keys/test'].includes(location.pathname)
                    const selected = location.pathname === child.path || isKeyDetail
                    return <ListItem key={child.path} disablePadding><ListItemButton selected={selected} onClick={() => handleNavigate(child.path)} sx={{ minHeight: 42, ml: 1.3, pl: 2.4, borderRadius: 2, color: selected ? 'primary.main' : 'text.secondary', '&.Mui-selected': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) } }}><ListItemIcon sx={{ minWidth: 34, color: 'inherit', '& .MuiSvgIcon-root': { fontSize: 18 } }}>{child.icon}</ListItemIcon><ListItemText primary={child.label} slotProps={{ primary: { sx: { fontSize: 13.5, fontWeight: selected ? 700 : 500 } } }} /></ListItemButton></ListItem>
                  })}</List></Collapse>}
                </Box>
              )
            })}
          </List>
        </Box>

        <Box sx={{ mt: 'auto', p: showText ? 2 : 1 }}>
          <Divider sx={{ mb: 2 }} />
          <Tooltip title={!showText ? 'admin · 시스템 관리자' : ''} placement="right">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: showText ? 'flex-start' : 'center', px: showText ? 1 : 0 }}>
              <Avatar sx={{ width: 40, height: 40, flexShrink: 0, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}><AccountCircleRounded /></Avatar>
              {showText && <Box sx={{ ml: 1.25 }}><Typography sx={{ fontSize: 14, fontWeight: 700 }}>admin</Typography><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>시스템 관리자 · ADMIN</Typography></Box>}
            </Box>
          </Tooltip>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" elevation={0} sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, transition: (theme) => theme.transitions.create(['width', 'margin-left']), borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha('#ffffff', 0.94), color: 'text.primary', backdropFilter: 'blur(12px)' }}>
        <Toolbar sx={{ minHeight: '72px !important', px: { xs: 2, sm: 3.5 } }}>
          <Tooltip title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}><IconButton aria-label="사이드바 토글" onClick={() => setCollapsed((value) => !value)} sx={{ display: { xs: 'none', md: 'inline-flex' }, mr: 1.5 }}>{collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}</IconButton></Tooltip>
          <IconButton aria-label="메뉴 열기" onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' }, mr: 1 }}><MenuRounded /></IconButton>
          <Typography sx={{ flexGrow: 1, fontSize: 18, fontWeight: 700 }}>{currentTitle}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}><Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}><Typography sx={{ fontSize: 14, fontWeight: 700 }}>admin</Typography><Typography sx={{ color: 'text.secondary', fontSize: 11.5 }}>ADMIN</Typography></Box><Tooltip title="로그아웃"><Button color="inherit" onClick={handleLogout} startIcon={<LogoutRounded sx={{ fontSize: 18 }} />} sx={{ minWidth: { xs: 42, sm: 'auto' }, px: { xs: 1, sm: 1.5 }, color: 'text.secondary', fontSize: 13 }}><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>로그아웃</Box></Button></Tooltip></Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 }, transition: (theme) => theme.transitions.create('width') }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: expandedWidth, border: 0 } }}>{renderDrawer(true)}</Drawer>
        <Drawer variant="permanent" open sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, overflowX: 'hidden', transition: (theme) => theme.transitions.create('width'), borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' } }}>{renderDrawer()}</Drawer>
      </Box>

      <Box component="main" sx={{ width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` }, minHeight: '100vh', pt: '72px', transition: (theme) => theme.transitions.create('width') }}><Box sx={{ width: '100%', maxWidth: 1500, mx: 'auto', p: { xs: 2, sm: 3, lg: 3.5 } }}><Outlet /></Box></Box>
    </Box>
  )
}

export default MainLayout
