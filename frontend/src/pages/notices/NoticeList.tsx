import { ResizableTable as Table } from '../../components/admin/ResizableTable'
import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { AddRounded, ArrowBackRounded, AttachFileRounded, CloseRounded, CloudUploadRounded, DeleteOutlineRounded, DownloadRounded, EditRounded, LockRounded, PushPinRounded, SearchRounded } from '@mui/icons-material'
import { Alert, Box, Button, Card, CardContent, FormControl, FormHelperText, IconButton, InputAdornment, InputLabel, List, ListItem, ListItemText, MenuItem, Pagination, Select, Stack, Switch, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { createNotice, deleteNotice as deleteNoticeApi, deleteNoticeFile, downloadNoticeFile, fetchNotice, fetchNoticePage, getApiErrorMessage, updateNotice } from '../../api/kms'
import { PageHeader } from '../../components/admin/AdminPage'
import { managementTableSx, managementTableContainerSx } from '../../components/admin/managementTable'
import { categoryMenuProps } from '../../components/admin/categoryMenu'
import { SearchFilterForm } from '../../components/admin/SearchFilterForm'
import { StatusBadge } from '../../components/common/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import type { Notice, NoticeListParams } from '../../types/api'
import { isAdminRole } from '../../types/auth'

type BoardForm = Pick<Notice, 'title' | 'content' | 'category' | 'exposeYn'>

const defaultParams: NoticeListParams = { title: '', category: 'ALL', exposeYn: 'ALL', page: 0, size: 5 }
const emptyForm: BoardForm = { title: '', content: '', category: 'GENERAL', exposeYn: 'Y' }

function NoticeList() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useState(defaultParams)
  const [draft, setDraft] = useState(defaultParams)
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
  const isAdmin = isAdminRole(user?.role)
  const canManage = (notice: Notice) => isAdmin || (notice.category === 'GENERAL' && notice.createdBy === user?.loginId)

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
    void fetchNoticePage(params).then((page) => { setNotices(page.content); setTotalElements(page.totalElements) }).catch((requestError) => setError(getApiErrorMessage(requestError, '게시글 목록을 불러오지 못했습니다.'))).finally(() => setLoading(false))
  }, [isCreate, isDetail, params])

  useEffect(() => {
    if (!noticeUid) { setSelectedNotice(null); return }
    setLoading(true)
    setError('')
    void fetchNotice(noticeUid).then((notice) => {
      setSelectedNotice(notice)
      setForm({ title: notice.title, content: notice.content, category: notice.category, exposeYn: notice.exposeYn })
      setFiles([])
      setEditing(false)
    }).catch((requestError) => setError(getApiErrorMessage(requestError, '게시글을 불러오지 못했습니다.'))).finally(() => setLoading(false))
  }, [noticeUid])

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setParams((current) => ({ ...current, title: draft.title, category: draft.category, exposeYn: draft.exposeYn, page: 0 }))
  }
  const resetFilters = () => { setDraft(defaultParams); setParams(defaultParams) }

  const openDetail = (notice: Notice) => {
    navigate(`/notices/${notice.noticeUid}`)
  }

  const selectFiles = (nextFiles: File[]) => {
    setFiles(nextFiles)
    if (nextFiles.length > 10) setError('첨부파일은 한 번에 최대 10개까지 등록할 수 있습니다.')
    else {
      const oversizedFile = nextFiles.find((file) => file.size > 10 * 1024 * 1024)
      setError(oversizedFile ? `${oversizedFile.name}: 첨부파일은 개별 10MB 이하여야 합니다.` : '')
    }
  }

  const dropFiles = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    selectFiles(Array.from(event.dataTransfer.files))
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
        setMessage('게시글과 첨부파일이 서버 DB에 저장되었습니다.')
      } else {
        const created = await createNotice(form, files)
        setMessage('게시글과 AES-256-GCM 암호화 첨부파일이 서버 DB에 등록되었습니다.')
        navigate(`/notices/${created.noticeUid}`)
      }
    } catch (requestError) { setError(getApiErrorMessage(requestError, '게시글을 저장하지 못했습니다.')) }
    finally { setSaving(false) }
  }

  const deleteNotice = async (notice: Notice) => {
    if (!canManage(notice)) return
    try { await deleteNoticeApi(notice.noticeUid); navigate('/notices') }
    catch (requestError) { setError(getApiErrorMessage(requestError, '게시글을 삭제하지 못했습니다.')) }
  }

  const deleteFile = async (fileUid: string) => {
    if (!selectedNotice || !canManage(selectedNotice)) return
    try { await deleteNoticeFile(fileUid); setSelectedNotice({ ...selectedNotice, files: selectedNotice.files.filter((file) => file.fileUid !== fileUid) }); setMessage('서버 DB의 암호화 첨부파일을 삭제했습니다.') }
    catch (requestError) { setError(getApiErrorMessage(requestError, '첨부파일을 삭제하지 못했습니다.')) }
  }

  if ((isDetail || isCreate) && !selectedNotice && !isCreate && !loading) {
    return <Box><Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/notices')}>게시글 목록</Button><Alert severity="error" sx={{ mt: 2 }}>요청한 게시글을 찾을 수 없습니다.</Alert></Box>
  }

  if (isDetail || isCreate) {
    const notice = selectedNotice
    const showEditor = isCreate || editing
    return (
      <Box className="notice-page" sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}><Button color="inherit" startIcon={<ArrowBackRounded />} onClick={() => navigate('/notices')}>목록</Button><Box sx={{ height: 40, borderLeft: '2px solid', borderColor: 'text.disabled' }} /><Box sx={{ minWidth: 0 }}><Typography variant="h5" noWrap>{isCreate ? '글 작성' : notice?.title}</Typography></Box></Stack>
          {notice && canManage(notice) && !showEditor && <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<EditRounded />} onClick={() => setEditing(true)}>수정</Button><Button color="error" startIcon={<DeleteOutlineRounded />} onClick={() => deleteNotice(notice)}>삭제</Button></Stack>}
        </Box>
        {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {showEditor ? (
          <Card className="section-card" sx={{ maxWidth: 980, mx: 'auto', overflow: 'hidden', borderRadius: '9px !important' }}>
            <Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">{isCreate ? '새 게시글 작성' : '게시글 수정'}</Typography></Box>
            <Box component="form" onSubmit={(event) => void saveNotice(event)}>
              <CardContent sx={{ p: { xs: '18px !important', sm: '22px !important' } }}>
                <Stack spacing={2.25}>
                  <FormControl fullWidth size="small"><InputLabel id="board-category-label">카테고리</InputLabel><Select MenuProps={categoryMenuProps} labelId="board-category-label" label="카테고리" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as BoardForm['category'] }))}><MenuItem value="GENERAL">글</MenuItem><MenuItem value="NOTICE" disabled={!isAdmin}>공지사항</MenuItem></Select><FormHelperText>{isAdmin ? '공지사항은 게시판 최상단에 강조 표시됩니다.' : '공지사항 카테고리는 관리자만 선택할 수 있습니다.'}</FormHelperText></FormControl>
                  <Box><Stack direction="row" spacing={.5} sx={{ mb: .75 }}><Typography component="label" htmlFor="notice-title" sx={{ fontSize: 12.5, fontWeight: 750 }}>제목</Typography><Typography component="span" color="error.main" sx={{ fontSize: 12.5, fontWeight: 850 }}>*</Typography></Stack><TextField id="notice-title" required fullWidth placeholder="게시글 제목을 입력하세요" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} slotProps={{ htmlInput: { maxLength: 255 } }} /><Typography sx={{ mt: .55, color: 'text.secondary', fontSize: 10.5, textAlign: 'right' }}>{form.title.length} / 255</Typography></Box>
                  <Box><Stack direction="row" spacing={.5} sx={{ mb: .75 }}><Typography component="label" htmlFor="notice-content" sx={{ fontSize: 12.5, fontWeight: 750 }}>본문</Typography><Typography component="span" color="error.main" sx={{ fontSize: 12.5, fontWeight: 850 }}>*</Typography></Stack><TextField id="notice-content" required fullWidth multiline minRows={10} placeholder="게시글 내용을 입력하세요" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} slotProps={{ htmlInput: { maxLength: 100000 } }} /><Typography sx={{ mt: .55, color: 'text.secondary', fontSize: 10.5, textAlign: 'right' }}>{form.content.length.toLocaleString()} / 100,000</Typography></Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}><Box><Typography sx={{ fontSize: 12.5, fontWeight: 750 }}>게시글 노출</Typography><Typography sx={{ mt: .25, color: 'text.secondary', fontSize: 10.5 }}>끄면 작성자와 관리자만 조회할 수 있습니다.</Typography></Box><Stack direction="row" spacing={.75} sx={{ alignItems: 'center' }}><Typography color={form.exposeYn === 'Y' ? 'primary.main' : 'text.secondary'} sx={{ fontSize: 11.5, fontWeight: 800 }}>{form.exposeYn === 'Y' ? '노출' : '숨김'}</Typography><Switch slotProps={{ input: { 'aria-label': '게시글 노출' } }} checked={form.exposeYn === 'Y'} onChange={(event) => setForm((current) => ({ ...current, exposeYn: event.target.checked ? 'Y' : 'N' }))} /></Stack></Box>
                  <Box><Box component="label" htmlFor="notice-files" onDragOver={(event) => event.preventDefault()} onDrop={dropFiles} sx={{ display: 'grid', minHeight: 142, placeItems: 'center', p: 2.5, border: '1.5px dashed', borderColor: 'primary.light', borderRadius: 2, bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(23,105,232,.025)' : 'rgba(23,105,232,.08)', textAlign: 'center', cursor: 'pointer', transition: 'border-color 180ms ease, background-color 180ms ease', '&:hover': { borderColor: 'primary.main', bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(23,105,232,.05)' : 'rgba(23,105,232,.12)' } }}><Box><CloudUploadRounded sx={{ mb: .6, color: 'primary.main', fontSize: 27 }} /><Typography sx={{ fontSize: 12.5, fontWeight: 750 }}>첨부파일을 선택하거나 끌어놓으세요</Typography><Typography sx={{ mt: .45, color: 'text.secondary', fontSize: 10.5 }}>개별 10MB 이하 · 최대 10개 · 서버 저장 전 AES-256-GCM 암호화</Typography></Box><input id="notice-files" hidden multiple type="file" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} /></Box>
                    {files.length === 0 ? <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 10.5 }}>선택된 첨부파일이 없습니다.</Typography> : <Stack spacing={.75} sx={{ mt: 1 }}>{files.map((file, index) => <Box key={`${file.name}-${file.lastModified}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: .8, borderRadius: 1.5, bgcolor: 'action.hover' }}><AttachFileRounded sx={{ color: 'primary.main', fontSize: 17 }} /><Typography noWrap sx={{ minWidth: 0, flex: 1, fontSize: 11.5 }}>{file.name}</Typography><Typography sx={{ flexShrink: 0, color: 'text.secondary', fontSize: 10.5 }}>{(file.size / 1024).toFixed(1)} KB</Typography><IconButton size="small" aria-label={`${file.name} 제거`} onClick={() => selectFiles(files.filter((_item, fileIndex) => fileIndex !== index))}><CloseRounded sx={{ fontSize: 17 }} /></IconButton></Box>)}</Stack>}
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 1.5, borderRadius: 2, bgcolor: (theme) => theme.palette.mode === 'light' ? '#edf4ff' : 'rgba(23,105,232,.12)', color: 'text.secondary' }}><LockRounded sx={{ flexShrink: 0, color: 'primary.main', fontSize: 18 }} /><Typography sx={{ fontSize: 11, lineHeight: 1.6 }}><Typography component="span" sx={{ mr: .8, color: 'primary.main', fontSize: 'inherit', fontWeight: 800 }}>보안 처리</Typography>파일 원문을 저장하지 않습니다.</Typography></Stack>
                </Stack>
              </CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: { xs: 2, sm: 2.75 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}><Button onClick={() => isCreate ? navigate('/notices') : setEditing(false)}>취소</Button><Button data-testid="notice-save-button" type="submit" variant="contained" disabled={saving || !form.title.trim() || !form.content.trim()}>{saving ? '등록 중…' : isCreate ? '등록' : '저장'}</Button></Box>
            </Box>
          </Card>
        ) : notice ? (
          <Stack spacing={2} sx={{ '& .section-card-header': { minHeight: 58, px: 2.25 }, '& .section-card-header h6': { fontSize: 16 }, '& .section-card': { borderRadius: 2 } }}>
            <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">게시글 상세</Typography><Stack direction="row" spacing={.75}><StatusBadge icon={notice.category === 'NOTICE' ? <PushPinRounded /> : undefined} label={notice.category === 'NOTICE' ? '공지' : '일반'} tone={notice.category === 'NOTICE' ? 'warning' : 'neutral'} minWidth={0} /><StatusBadge status={notice.exposeYn} minWidth={0} /><StatusBadge label={`조회 ${notice.viewCount.toLocaleString()}`} tone="neutral" minWidth={0} /></Stack></Box><CardContent sx={{ p: '20px !important' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: .5, sm: 2 }} sx={{ mb: 2, color: 'text.secondary' }}><Typography sx={{ fontSize: 11 }}>작성자 <strong>{notice.createdBy}</strong></Typography><Typography sx={{ fontSize: 11 }}>등록 {notice.createdAt.slice(0, 10)}</Typography><Typography sx={{ fontSize: 11 }}>수정 {new Date(notice.updatedAt).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })}</Typography></Stack><Typography sx={{ minHeight: 220, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 16, fontWeight: 400, lineHeight: 1.9 }}>{notice.content}</Typography></CardContent></Card>
            <Card className="section-card"><Box className="section-card-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Typography variant="h6">첨부파일</Typography><StatusBadge icon={<AttachFileRounded />} label={`${notice.files.length}개`} tone="neutral" minWidth={0} /></Box><CardContent sx={{ p: '8px 20px 16px !important' }}>{notice.files.length === 0 ? <Typography color="text.secondary" sx={{ py: 3 }}>첨부파일이 없습니다.</Typography> : <List disablePadding>{notice.files.map((file) => <ListItem key={file.fileUid} divider sx={{ minHeight: 66, gap: 1.5, pl: 0 }} secondaryAction={<Stack direction="row" spacing={.5}><Button size="small" startIcon={<DownloadRounded />} onClick={() => void downloadNoticeFile(file.fileUid, file.originalName)}>다운로드</Button>{canManage(notice) && <Button color="error" size="small" onClick={() => void deleteFile(file.fileUid)}>삭제</Button>}</Stack>}><IconButton aria-label={`${file.originalName} 다운로드`} onClick={() => void downloadNoticeFile(file.fileUid, file.originalName)} sx={{ bgcolor: "primary.light", color: "primary.main", borderRadius: 2, width: 38, height: 38 }}><DownloadRounded fontSize="small" /></IconButton><ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 700 } }, secondary: { sx: { fontSize: 10, mt: .3 } } }} primary={file.originalName} secondary={`${(file.size / 1024).toFixed(1)} KB · 암호화 저장`} /></ListItem>)}</List>}</CardContent></Card>
          </Stack>
        ) : null}
      </Box>
    )
  }

  return (
    <Box className="notice-page list-page" sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <PageHeader title="게시판" description="여러분의 목소리를 담습니다" action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/notices/new')}>글 작성</Button>} />
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <SearchFilterForm columns={3} onSearch={search} onReset={resetFilters}>
        <TextField size="small" label="제목 검색" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
        <FormControl size="small"><InputLabel id="notice-filter-category-label">카테고리</InputLabel><Select MenuProps={categoryMenuProps} labelId="notice-filter-category-label" label="카테고리" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as NoticeListParams['category'] }))}><MenuItem value="ALL">전체 카테고리</MenuItem><MenuItem value="NOTICE">공지사항</MenuItem><MenuItem value="GENERAL">글</MenuItem></Select></FormControl>
        <FormControl size="small"><InputLabel id="notice-filter-exposure-label">노출 상태</InputLabel><Select MenuProps={categoryMenuProps} labelId="notice-filter-exposure-label" label="노출 상태" value={draft.exposeYn} onChange={(event) => setDraft((current) => ({ ...current, exposeYn: event.target.value as NoticeListParams['exposeYn'] }))}><MenuItem value="ALL">전체 상태</MenuItem><MenuItem value="Y">노출</MenuItem><MenuItem value="N">숨김</MenuItem></Select></FormControl>
      </SearchFilterForm>
      <Card className="section-card list-results" sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: '2px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ fontSize: 14, fontWeight: 800 }}>게시글 목록</Typography><StatusBadge label={`${totalElements.toLocaleString()}건`} tone="neutral" minWidth={0} /></Box>
        <TableContainer sx={managementTableContainerSx}>
          <Table stickyHeader size="small" sx={[managementTableSx, { '& .MuiTableCell-body': { fontSize: 13.25 }, '& .MuiTableCell-head': { fontSize: 13, fontWeight: 800 } }]}>
            <TableHead><TableRow><TableCell>#</TableCell><TableCell sx={{ width: 120 }}>구분</TableCell><TableCell sx={{ width: 380 }}>제목</TableCell><TableCell sx={{ width: 95 }}>첨부</TableCell><TableCell sx={{ width: 105 }}>노출</TableCell><TableCell sx={{ width: 150 }}>작성자</TableCell><TableCell sx={{ width: 130 }}>등록일</TableCell><TableCell sx={{ width: 95 }} align="center">조회수</TableCell></TableRow></TableHead>
            <TableBody>{notices.map((notice, index) => (
              <TableRow key={notice.noticeUid} hover tabIndex={0} className="interactive-row" sx={{ cursor: 'pointer', ...(notice.category === 'NOTICE' ? { '& .MuiTableCell-body': { bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(249, 115, 22, .07)' : 'rgba(249, 115, 22, .12)' }, '&:hover .MuiTableCell-body': { bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(249, 115, 22, .12)' : 'rgba(249, 115, 22, .18)' }, '& .MuiTableCell-body:first-of-type': { boxShadow: 'inset 4px 0 0 #f59e0b' } } : { '&:hover': { bgcolor: 'action.hover' } }) }} onClick={() => openDetail(notice)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openDetail(notice) }}>
                <TableCell>{params.page * params.size + index + 1}</TableCell>
                <TableCell><StatusBadge icon={notice.category === 'NOTICE' ? <PushPinRounded /> : undefined} label={notice.category === 'NOTICE' ? '공지' : '일반'} tone={notice.category === 'NOTICE' ? 'warning' : 'neutral'} minWidth={0} sx={notice.category === 'NOTICE' ? { color: '#c2410c', bgcolor: '#fff1e7', borderColor: '#fed7aa' } : undefined} /></TableCell>
                <TableCell><Typography sx={{ fontWeight: isAdminRole(notice.authorRole) ? 800 : 400, fontSize: 16 }}>{notice.title}</Typography></TableCell>
                <TableCell><Stack direction="row" spacing={.65} sx={{ alignItems: 'center', color: notice.files.length ? 'primary.main' : 'text.disabled' }}><AttachFileRounded sx={{ fontSize: 17 }} /><Typography sx={{ fontSize: 12.5, fontWeight: 750 }}>{notice.files.length}개</Typography></Stack></TableCell>
                <TableCell><StatusBadge dot status={notice.exposeYn} label={notice.exposeYn === 'Y' ? '노출' : '숨김'} minWidth={0} /></TableCell>
                <TableCell><Typography sx={{ fontSize: 13.25, fontWeight: 400 }}>{notice.createdBy}</Typography></TableCell>
                <TableCell><Typography sx={{ color: 'text.secondary', fontSize: 12.25 }}>{notice.createdAt.split('T')[0]}</Typography></TableCell>
                <TableCell align="center" sx={{ fontSize: 13.5, fontWeight: 800 }}>{notice.viewCount.toLocaleString()}</TableCell>
              </TableRow>
            ))}{!loading && notices.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>조건에 맞는 게시글이 없습니다.</TableCell></TableRow>}{loading && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>게시글을 불러오는 중입니다.</TableCell></TableRow>}</TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{totalElements === 0 ? '0건' : `${params.page * params.size + 1}–${Math.min((params.page + 1) * params.size, totalElements)} / ${totalElements.toLocaleString()}건`} · 공지 우선</Typography><Pagination count={Math.max(1, Math.ceil(totalElements / params.size))} page={params.page + 1} onChange={(_event, page) => setParams((current) => ({ ...current, page: page - 1 }))} color="primary" size="small" siblingCount={1} boundaryCount={1} sx={{ '& .MuiPaginationItem-root': { minWidth: 32, height: 32, border: '1px solid', borderColor: 'divider', borderRadius: 1.25, fontWeight: 700 }, '& .Mui-selected': { borderColor: 'primary.main' } }} /></Box>
      </Card>
    </Box>
  )
}

export default NoticeList
