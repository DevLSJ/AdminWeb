import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AddRounded, ArrowBackRounded, AttachFileRounded, DeleteOutlineRounded, DownloadRounded, EditRounded, SearchRounded } from '@mui/icons-material'
import { Alert, Box, Button, Card, CardContent, FormControl, FormControlLabel, InputAdornment, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { FilterCard, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { mockNotices } from '../../mocks/adminData'
import type { Notice, NoticeFile, NoticeListParams } from '../../types/api'
import { isAdminRole } from '../../types/auth'

const defaultParams: NoticeListParams = { title: '', exposeYn: 'ALL', page: 0, size: 5 }
const emptyForm = { title: '', content: '', exposeYn: 'Y' as 'Y' | 'N' }

function downloadMockFile(file: NoticeFile) {
  const content = `D'Guard KMS mock decrypted file\noriginalName=${file.originalName}\nencVer=${file.encVer}`
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.originalName
  anchor.click()
  URL.revokeObjectURL(url)
}

function NoticeList() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useState(defaultParams)
  const [notices, setNotices] = useState(mockNotices)
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  const pathParts = location.pathname.split('/').filter(Boolean)
  const isCreate = pathParts[1] === 'new'
  const noticeUid = isCreate ? '' : pathParts[1] ?? ''
  const selectedNotice = notices.find((notice) => notice.noticeUid === noticeUid)
  const isDetail = Boolean(noticeUid)
  const filteredNotices = useMemo(() => notices.filter((notice) => (!params.title.trim() || notice.title.toLowerCase().includes(params.title.trim().toLowerCase())) && (params.exposeYn === 'ALL' || notice.exposeYn === params.exposeYn)), [notices, params])
  const pageContent = filteredNotices.slice(params.page * params.size, (params.page + 1) * params.size)
  const canManage = (notice: Notice) => isAdminRole(user?.role) || notice.createdBy === user?.loginId

  useEffect(() => {
    if (isCreate) {
      setForm(emptyForm)
      setFiles([])
      setEditing(true)
    } else if (selectedNotice) {
      setForm({ title: selectedNotice.title, content: selectedNotice.content, exposeYn: selectedNotice.exposeYn })
      setFiles([])
      setEditing(false)
    }
  }, [isCreate, noticeUid, selectedNotice])

  const updateParam = <K extends keyof NoticeListParams>(key: K, value: NoticeListParams[K]) => setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))
  const openDetail = (notice: Notice) => {
    setNotices((current) => current.map((item) => item.noticeUid === notice.noticeUid ? { ...item, viewCount: item.viewCount + 1 } : item))
    navigate(`/notices/${notice.noticeUid}`)
  }

  const saveNotice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const uploadedFiles: NoticeFile[] = files.map((file) => ({ fileUid: `file-${crypto.randomUUID().slice(0, 8)}`, originalName: file.name, size: file.size, encVer: 1 }))
    if (selectedNotice) {
      if (!canManage(selectedNotice)) return
      setNotices((current) => current.map((notice) => notice.noticeUid === selectedNotice.noticeUid ? { ...notice, ...form, files: [...notice.files, ...uploadedFiles], updatedAt: '2026-09-01 11:30:00' } : notice))
      setEditing(false)
      setFiles([])
      setMessage('공지가 수정되고 신규 첨부파일이 마스터키로 암호화되었습니다.')
      return
    }
    const created: Notice = { noticeUid: `notice-${crypto.randomUUID().slice(0, 8)}`, ...form, viewCount: 0, createdBy: user?.loginId ?? 'unknown', createdAt: '2026-09-01 11:30:00', updatedAt: '2026-09-01 11:30:00', files: uploadedFiles }
    setNotices((current) => [created, ...current])
    setMessage('공지가 등록되었습니다. 첨부파일은 AES-256-GCM 암호문으로 저장됩니다.')
    navigate(`/notices/${created.noticeUid}`)
  }

  const deleteNotice = (notice: Notice) => {
    if (!canManage(notice)) return
    setNotices((current) => current.filter((item) => item.noticeUid !== notice.noticeUid))
    navigate('/notices')
  }

  const deleteFile = (fileUid: string) => {
    if (!selectedNotice || !canManage(selectedNotice)) return
    setNotices((current) => current.map((notice) => notice.noticeUid === selectedNotice.noticeUid ? { ...notice, files: notice.files.filter((file) => file.fileUid !== fileUid) } : notice))
    setMessage('첨부파일과 notice_file 레코드가 삭제되었습니다.')
  }

  if ((isDetail || isCreate) && !selectedNotice && !isCreate) {
    return <Box><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/notices')}>공지 목록</Button><Alert severity="error" sx={{ mt: 2 }}>요청한 공지를 찾을 수 없습니다.</Alert></Box>
  }

  if (isDetail || isCreate) {
    const notice = selectedNotice
    const showEditor = isCreate || editing
    return (
      <Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}><Button color="inherit" startIcon={<ArrowBackRounded />} onClick={() => navigate('/notices')}>공지 목록</Button><Box sx={{ minWidth: 0 }}><Typography variant="h5" noWrap>{isCreate ? '공지 등록' : notice?.title}</Typography>{notice && <Typography sx={{ mt: .2, color: 'text.secondary', fontSize: 11.5 }}>{notice.noticeUid}</Typography>}</Box></Stack>
          {notice && canManage(notice) && !showEditor && <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEditing(true)}>수정</Button><Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => deleteNotice(notice)}>삭제</Button></Stack>}
        </Box>
        {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
        {showEditor ? (
          <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center' }}><Typography variant="h6">{isCreate ? '새 공지 작성' : '공지 수정'}</Typography></Box><Box component="form" onSubmit={saveNotice}><CardContent sx={{ p: '20px !important' }}><Stack spacing={2}><TextField required label="제목" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><TextField required multiline minRows={10} label="본문" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /><FormControlLabel control={<Switch checked={form.exposeYn === 'Y'} onChange={(event) => setForm((current) => ({ ...current, exposeYn: event.target.checked ? 'Y' : 'N' }))} />} label="공지 노출" /><Button component="label" variant="outlined" startIcon={<AttachFileRounded />} sx={{ alignSelf: 'flex-start' }}>첨부파일 선택<input hidden multiple type="file" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></Button>{files.length > 0 && <Alert severity="info">선택한 {files.length}개 파일은 업로드 시 마스터키 AES-256-GCM으로 암호화됩니다.</Alert>}</Stack></CardContent><Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{!isCreate && <Button onClick={() => setEditing(false)}>취소</Button>}<Button type="submit" variant="contained" disabled={!form.title.trim() || !form.content.trim()}>저장</Button></Box></Box></Card>
        ) : notice ? (
          <Stack spacing={2}>
            <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">공지 상세</Typography><Stack direction="row" spacing={.75}><StatusBadge status={notice.exposeYn} minWidth={0} /><StatusBadge label={`조회 ${notice.viewCount.toLocaleString()}`} tone="neutral" minWidth={0} /></Stack></Box><CardContent sx={{ p: '20px !important' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: .5, sm: 2 }} sx={{ mb: 2, color: 'text.secondary' }}><Typography sx={{ fontSize: 12.5 }}>작성자 {notice.createdBy}</Typography><Typography sx={{ fontSize: 12.5 }}>등록 {notice.createdAt}</Typography><Typography sx={{ fontSize: 12.5 }}>수정 {notice.updatedAt}</Typography></Stack><Typography sx={{ minHeight: 180, whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>{notice.content}</Typography></CardContent></Card>
            <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">첨부파일</Typography><StatusBadge icon={<AttachFileRounded />} label={`${notice.files.length}개`} tone="neutral" minWidth={0} /></Box><CardContent sx={{ p: '8px 20px 16px !important' }}>{notice.files.length === 0 ? <Typography color="text.secondary" sx={{ py: 3 }}>첨부파일이 없습니다.</Typography> : <List disablePadding>{notice.files.map((file) => <ListItem key={file.fileUid} divider secondaryAction={<Stack direction="row" spacing={.5}><Button size="small" startIcon={<DownloadRounded />} onClick={() => { downloadMockFile(file); setMessage('첨부파일을 복호화해 다운로드하고 감사로그를 기록했습니다.') }}>복호화 다운로드</Button>{canManage(notice) && <Button color="error" size="small" onClick={() => deleteFile(file.fileUid)}>삭제</Button>}</Stack>}><ListItemText primary={file.originalName} secondary={`${(file.size / 1024).toFixed(1)} KB · enc_ver ${file.encVer}`} /></ListItem>)}</List>}</CardContent></Card>
          </Stack>
        ) : null}
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader title="공지사항" action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/notices/new')}>공지 등록</Button>} />
      <FilterCard><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1.5fr) minmax(160px, .5fr) auto' }, gap: 1.25 }}><TextField size="small" label="제목 검색" value={params.title} onChange={(event) => updateParam('title', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} /><FormControl size="small"><InputLabel>노출 상태</InputLabel><Select label="노출 상태" value={params.exposeYn} onChange={(event) => updateParam('exposeYn', event.target.value as NoticeListParams['exposeYn'])}><MenuItem value="ALL">전체</MenuItem><MenuItem value="Y">노출</MenuItem><MenuItem value="N">숨김</MenuItem></Select></FormControl><Button color="inherit" onClick={() => setParams((current) => ({ ...defaultParams, size: current.size }))}>초기화</Button></Box></FilterCard>
      <Card sx={{ overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: .8, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>공지사항 {filteredNotices.length.toLocaleString()}건</Typography><FormControl size="small" sx={{ minWidth: 128 }}><Select value={params.size} onChange={(event) => updateParam('size', Number(event.target.value))}>{[5, 10, 20].map((size) => <MenuItem key={size} value={size}>{size}개씩 보기</MenuItem>)}</Select></FormControl></Box>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)', minHeight: 360 }}><Table stickyHeader size="small" className="dense-data-table" sx={{ minWidth: 880, '& .MuiTableCell-root': { px: 1.25, py: .72 }, '& .MuiTableCell-head': { py: .9, bgcolor: 'background.paper', fontSize: 12 } }}><TableHead><TableRow><TableCell>제목</TableCell><TableCell>첨부</TableCell><TableCell>노출</TableCell><TableCell>작성자</TableCell><TableCell>등록일</TableCell><TableCell align="right">조회수</TableCell></TableRow></TableHead><TableBody>{pageContent.map((notice) => <TableRow key={notice.noticeUid} hover tabIndex={0} className="interactive-row" sx={{ cursor: 'pointer' }} onClick={() => openDetail(notice)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDetail(notice) }}><TableCell><Typography sx={{ fontWeight: 750, fontSize: 12.75 }}>{notice.title}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 10.5 }}>{notice.noticeUid}</Typography></TableCell><TableCell><StatusBadge icon={<AttachFileRounded />} label={`${notice.files.length}개`} tone="neutral" minWidth={0} /></TableCell><TableCell><StatusBadge status={notice.exposeYn} minWidth={0} /></TableCell><TableCell>{notice.createdBy}{notice.createdBy === user?.loginId && <StatusBadge label="내 글" tone="accent" minWidth={0} sx={{ ml: .75 }} />}</TableCell><TableCell><Typography sx={{ color: 'text.secondary', fontSize: 11.25 }}>{notice.createdAt.split(' ')[0]}</Typography></TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{notice.viewCount.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={filteredNotices.length} onPageChange={(page) => updateParam('page', page)} />
      </Card>
    </Box>
  )
}

export default NoticeList
