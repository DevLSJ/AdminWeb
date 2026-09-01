import { useEffect, useState, type FormEvent } from 'react'
import { AddRounded, ArrowBackRounded, AttachFileRounded, DeleteOutlineRounded, DownloadRounded, EditRounded, SearchRounded } from '@mui/icons-material'
import { Alert, Box, Button, Card, CardContent, FormControl, FormControlLabel, InputAdornment, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { createNotice, deleteNotice as deleteNoticeApi, deleteNoticeFile, downloadNoticeFile, fetchNotice, fetchNoticePage, getApiErrorMessage, updateNotice } from '../../api/kms'
import { FilterCard, PageHeader, PaginationBar } from '../../components/admin/AdminPage'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type { Notice, NoticeListParams } from '../../types/api'
import { isAdminRole } from '../../types/auth'

const defaultParams: NoticeListParams = { title: '', exposeYn: 'ALL', page: 0, size: 5 }
const emptyForm = { title: '', content: '', exposeYn: 'Y' as 'Y' | 'N' }

function NoticeList() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useState(defaultParams)
  const [notices, setNotices] = useState<Notice[]>([])
  const [totalElements, setTotalElements] = useState(0)
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState<File[]>([])
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const pathParts = location.pathname.split('/').filter(Boolean)
  const isCreate = pathParts[1] === 'new'
  const noticeUid = isCreate ? '' : pathParts[1] ?? ''
  const isDetail = Boolean(noticeUid)
  const canManage = (notice: Notice) => isAdminRole(user?.role) || notice.createdBy === user?.loginId

  useEffect(() => {
    if (isCreate) {
      setForm(emptyForm)
      setFiles([])
      setEditing(true)
    }
  }, [isCreate])

  useEffect(() => {
    if (isCreate || isDetail) return
    setLoading(true)
    setError('')
    void fetchNoticePage(params).then((page) => { setNotices(page.content); setTotalElements(page.totalElements) }).catch((requestError) => setError(getApiErrorMessage(requestError, '공지 목록을 불러오지 못했습니다.'))).finally(() => setLoading(false))
  }, [isCreate, isDetail, params])

  useEffect(() => {
    if (!noticeUid) { setSelectedNotice(null); return }
    setLoading(true)
    setError('')
    void fetchNotice(noticeUid).then((notice) => {
      setSelectedNotice(notice)
      setForm({ title: notice.title, content: notice.content, exposeYn: notice.exposeYn })
      setFiles([])
      setEditing(false)
    }).catch((requestError) => setError(getApiErrorMessage(requestError, '공지를 불러오지 못했습니다.'))).finally(() => setLoading(false))
  }, [noticeUid])

  const updateParam = <K extends keyof NoticeListParams>(key: K, value: NoticeListParams[K]) => setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))
  const openDetail = (notice: Notice) => {
    navigate(`/notices/${notice.noticeUid}`)
  }

  const saveNotice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (files.length > 10) {
      setError('첨부파일은 한 번에 최대 10개까지 등록할 수 있습니다.')
      return
    }
    const oversizedFile = files.find((file) => file.size > 10 * 1024 * 1024)
    if (oversizedFile) {
      setError(`${oversizedFile.name}: 첨부파일은 개별 10MB 이하여야 합니다.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      if (selectedNotice) {
        if (!canManage(selectedNotice)) return
        const updated = await updateNotice(selectedNotice.noticeUid, form, files)
        setSelectedNotice(updated)
        setEditing(false)
        setFiles([])
        setMessage('공지와 첨부파일이 서버 DB에 저장되었습니다.')
      } else {
        const created = await createNotice(form, files)
        setMessage('공지와 AES-256-GCM 암호화 첨부파일이 서버 DB에 등록되었습니다.')
        navigate(`/notices/${created.noticeUid}`)
      }
    } catch (requestError) { setError(getApiErrorMessage(requestError, '공지를 저장하지 못했습니다.')) }
    finally { setSaving(false) }
  }

  const deleteNotice = async (notice: Notice) => {
    if (!canManage(notice)) return
    try { await deleteNoticeApi(notice.noticeUid); navigate('/notices') }
    catch (requestError) { setError(getApiErrorMessage(requestError, '공지를 삭제하지 못했습니다.')) }
  }

  const deleteFile = async (fileUid: string) => {
    if (!selectedNotice || !canManage(selectedNotice)) return
    try { await deleteNoticeFile(fileUid); setSelectedNotice({ ...selectedNotice, files: selectedNotice.files.filter((file) => file.fileUid !== fileUid) }); setMessage('서버 DB의 암호화 첨부파일을 삭제했습니다.') }
    catch (requestError) { setError(getApiErrorMessage(requestError, '첨부파일을 삭제하지 못했습니다.')) }
  }

  if ((isDetail || isCreate) && !selectedNotice && !isCreate && !loading) {
    return <Box><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/notices')}>공지 목록</Button><Alert severity="error" sx={{ mt: 2 }}>요청한 공지를 찾을 수 없습니다.</Alert></Box>
  }

  if (isDetail || isCreate) {
    const notice = selectedNotice
    const showEditor = isCreate || editing
    return (
      <Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}><Button color="inherit" startIcon={<ArrowBackRounded />} onClick={() => navigate('/notices')}>공지 목록</Button><Box sx={{ height: 40, borderLeft: '2px solid', borderColor: 'text.disabled' }} /><Box sx={{ minWidth: 0 }}><Typography variant="h5" noWrap>{isCreate ? '공지 등록' : notice?.title}</Typography>{notice && <Typography sx={{ mt: .2, color: 'text.secondary', fontSize: 11.5 }}>{notice.noticeUid}</Typography>}</Box></Stack>
          {notice && canManage(notice) && !showEditor && <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEditing(true)}>수정</Button><Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => deleteNotice(notice)}>삭제</Button></Stack>}
        </Box>
        {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {showEditor ? (
          <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center' }}><Typography variant="h6">{isCreate ? '새 공지 작성' : '공지 수정'}</Typography></Box><Box component="form" onSubmit={(event) => void saveNotice(event)}><CardContent sx={{ p: '20px !important' }}><Stack spacing={2}><TextField required label="제목" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><TextField required multiline minRows={10} label="본문" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /><FormControlLabel control={<Switch checked={form.exposeYn === 'Y'} onChange={(event) => setForm((current) => ({ ...current, exposeYn: event.target.checked ? 'Y' : 'N' }))} />} label="공지 노출" /><Button component="label" variant="outlined" startIcon={<AttachFileRounded />} sx={{ alignSelf: 'flex-start' }}>첨부파일 선택<input hidden multiple type="file" onChange={(event) => { setFiles(Array.from(event.target.files ?? [])); setError('') }} /></Button>{files.length > 0 && <Alert severity="info">선택한 {files.length}개 파일은 업로드 시 마스터키 AES-256-GCM으로 암호화됩니다. (개별 10MB · 최대 10개)</Alert>}</Stack></CardContent><Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{!isCreate && <Button onClick={() => setEditing(false)}>취소</Button>}<Button data-testid="notice-save-button" type="submit" variant="contained" disabled={saving || !form.title.trim() || !form.content.trim()}>{saving ? '등록 중…' : '저장'}</Button></Box></Box></Card>
        ) : notice ? (
          <Stack spacing={2}>
            <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">공지 상세</Typography><Stack direction="row" spacing={.75}><StatusBadge status={notice.exposeYn} minWidth={0} /><StatusBadge label={`조회 ${notice.viewCount.toLocaleString()}`} tone="neutral" minWidth={0} /></Stack></Box><CardContent sx={{ p: '20px !important' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: .5, sm: 2 }} sx={{ mb: 2, color: 'text.secondary' }}><Typography sx={{ fontSize: 12.5 }}>작성자 {notice.createdBy}</Typography><Typography sx={{ fontSize: 12.5 }}>등록 {notice.createdAt}</Typography><Typography sx={{ fontSize: 12.5 }}>수정 {notice.updatedAt}</Typography></Stack><Typography sx={{ minHeight: 180, whiteSpace: 'pre-wrap', lineHeight: 1.85 }}>{notice.content}</Typography></CardContent></Card>
            <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">첨부파일</Typography><StatusBadge icon={<AttachFileRounded />} label={`${notice.files.length}개`} tone="neutral" minWidth={0} /></Box><CardContent sx={{ p: '8px 20px 16px !important' }}>{notice.files.length === 0 ? <Typography color="text.secondary" sx={{ py: 3 }}>첨부파일이 없습니다.</Typography> : <List disablePadding>{notice.files.map((file) => <ListItem key={file.fileUid} divider secondaryAction={<Stack direction="row" spacing={.5}><Button size="small" startIcon={<DownloadRounded />} onClick={() => void downloadNoticeFile(file.fileUid, file.originalName)}>복호화 다운로드</Button>{canManage(notice) && <Button color="error" size="small" onClick={() => void deleteFile(file.fileUid)}>삭제</Button>}</Stack>}><ListItemText primary={file.originalName} secondary={`${(file.size / 1024).toFixed(1)} KB · enc_ver ${file.encVer}`} /></ListItem>)}</List>}</CardContent></Card>
          </Stack>
        ) : null}
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader title="공지사항" action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/notices/new')}>공지 등록</Button>} />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <FilterCard><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1.5fr) minmax(160px, .5fr) auto' }, gap: 1.25 }}><TextField size="small" label="제목 검색" value={params.title} onChange={(event) => updateParam('title', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} /><FormControl size="small"><InputLabel>노출 상태</InputLabel><Select label="노출 상태" value={params.exposeYn} onChange={(event) => updateParam('exposeYn', event.target.value as NoticeListParams['exposeYn'])}><MenuItem value="ALL">전체</MenuItem><MenuItem value="Y">노출</MenuItem><MenuItem value="N">숨김</MenuItem></Select></FormControl><Button color="inherit" onClick={() => setParams((current) => ({ ...defaultParams, size: current.size }))}>초기화</Button></Box></FilterCard>
      <Card sx={{ overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: .8, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>공지사항 {totalElements.toLocaleString()}건</Typography><FormControl size="small" sx={{ minWidth: 128 }}><Select value={params.size} onChange={(event) => updateParam('size', Number(event.target.value))}>{[5, 10, 20].map((size) => <MenuItem key={size} value={size}>{size}개씩 보기</MenuItem>)}</Select></FormControl></Box>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)', minHeight: 360 }}><Table stickyHeader size="small" className="dense-data-table" sx={{ minWidth: 880, '& .MuiTableCell-root': { px: 1.25, py: .72 }, '& .MuiTableCell-head': { py: .9, bgcolor: 'background.paper', fontSize: 12 } }}><TableHead><TableRow><TableCell>제목</TableCell><TableCell>첨부</TableCell><TableCell>노출</TableCell><TableCell>작성자</TableCell><TableCell>등록일</TableCell><TableCell align="right">조회수</TableCell></TableRow></TableHead><TableBody>{notices.map((notice) => <TableRow key={notice.noticeUid} hover tabIndex={0} className="interactive-row" sx={{ cursor: 'pointer' }} onClick={() => openDetail(notice)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDetail(notice) }}><TableCell><Typography sx={{ fontWeight: 750, fontSize: 12.75 }}>{notice.title}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 10.5 }}>{notice.noticeUid}</Typography></TableCell><TableCell><StatusBadge icon={<AttachFileRounded />} label={`${notice.files.length}개`} tone="neutral" minWidth={0} /></TableCell><TableCell><StatusBadge status={notice.exposeYn} minWidth={0} /></TableCell><TableCell>{notice.createdBy}{notice.createdBy === user?.loginId && <StatusBadge label="내 글" tone="accent" minWidth={0} sx={{ ml: .75 }} />}</TableCell><TableCell><Typography sx={{ color: 'text.secondary', fontSize: 11.25 }}>{notice.createdAt.split('T')[0]}</Typography></TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{notice.viewCount.toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={totalElements} onPageChange={(page) => updateParam('page', page)} />
      </Card>
    </Box>
  )
}

export default NoticeList
