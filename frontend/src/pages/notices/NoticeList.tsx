import { useMemo, useState, type FormEvent } from 'react'
import { AddRounded, AttachFileRounded, DeleteOutlineRounded, DownloadRounded, EditRounded, SearchRounded, VisibilityRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
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

function NoticeList({ autoCreate = false }: { autoCreate?: boolean }) {
  const { user } = useAuth()
  const [params, setParams] = useState(defaultParams)
  const [notices, setNotices] = useState(mockNotices)
  const [detail, setDetail] = useState<Notice | null>(null)
  const [editor, setEditor] = useState<Notice | null | undefined>(autoCreate ? null : undefined)
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')

  const filteredNotices = useMemo(() => notices.filter((notice) => (!params.title.trim() || notice.title.toLowerCase().includes(params.title.trim().toLowerCase())) && (params.exposeYn === 'ALL' || notice.exposeYn === params.exposeYn)), [notices, params])
  const pageContent = filteredNotices.slice(params.page * params.size, (params.page + 1) * params.size)

  const updateParam = <K extends keyof NoticeListParams>(key: K, value: NoticeListParams[K]) => setParams((current) => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 0 }))
  const canManage = (notice: Notice) => isAdminRole(user?.role) || notice.createdBy === user?.loginId
  const toggleExpose = (notice: Notice) => {
    if (!canManage(notice)) return
    const exposeYn = notice.exposeYn === 'Y' ? 'N' : 'Y'
    setNotices((current) => current.map((item) => item.noticeUid === notice.noticeUid ? { ...item, exposeYn } : item))
    setDetail((current) => current?.noticeUid === notice.noticeUid ? { ...current, exposeYn } : current)
    setMessage(`${notice.title} 공지가 ${exposeYn === 'Y' ? '노출' : '숨김'} 상태로 변경되었습니다.`)
  }
  const openEditor = (notice: Notice | null) => {
    if (notice && !canManage(notice)) {
      setMessage('CLIENT는 본인이 작성한 공지만 수정할 수 있습니다.')
      return
    }
    setEditor(notice)
    setForm(notice ? { title: notice.title, content: notice.content, exposeYn: notice.exposeYn } : emptyForm)
    setFiles([])
  }

  const openDetail = (notice: Notice) => {
    const viewed = { ...notice, viewCount: notice.viewCount + 1 }
    setNotices((current) => current.map((item) => item.noticeUid === notice.noticeUid ? viewed : item))
    setDetail(viewed)
  }

  const saveNotice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const uploadedFiles: NoticeFile[] = files.map((file) => ({ fileUid: `file-${crypto.randomUUID().slice(0, 8)}`, originalName: file.name, size: file.size, encVer: 1 }))
    if (editor) {
      if (!canManage(editor)) return
      setNotices((current) => current.map((notice) => notice.noticeUid === editor.noticeUid ? { ...notice, ...form, files: [...notice.files, ...uploadedFiles], updatedAt: '2026-08-19 17:40:00' } : notice))
      setMessage('공지가 수정되고 신규 첨부파일이 마스터키로 암호화되었습니다.')
    } else {
      const created: Notice = { noticeUid: `notice-${crypto.randomUUID().slice(0, 8)}`, ...form, viewCount: 0, createdBy: user?.loginId ?? 'unknown', createdAt: '2026-08-20 09:00:00', updatedAt: '2026-08-20 09:00:00', files: uploadedFiles }
      setNotices((current) => [created, ...current])
      setMessage('공지가 등록되었습니다. 첨부파일은 AES-256-GCM 암호문으로 저장됩니다.')
    }
    setEditor(undefined)
  }

  const deleteNotice = (notice: Notice) => {
    if (!canManage(notice)) {
      setMessage('CLIENT는 본인이 작성한 공지만 삭제할 수 있습니다.')
      return
    }
    setNotices((current) => current.filter((item) => item.noticeUid !== notice.noticeUid))
    setDetail(null)
    setMessage(`${notice.title} 공지와 암호화된 첨부파일 ${notice.files.length}개가 함께 정리되었습니다.`)
  }

  const deleteFile = (fileUid: string) => {
    if (!detail) return
    if (!canManage(detail)) {
      setMessage('CLIENT는 본인이 작성한 글의 첨부파일만 삭제할 수 있습니다.')
      return
    }
    const updated = { ...detail, files: detail.files.filter((file) => file.fileUid !== fileUid) }
    setDetail(updated)
    setNotices((current) => current.map((notice) => notice.noticeUid === updated.noticeUid ? updated : notice))
    setMessage('첨부파일과 notice_file 레코드가 삭제되었습니다.')
  }

  return (
    <Box>
      <PageHeader title="공지사항" description={isAdminRole(user?.role) ? '전체 공지 노출 상태와 첨부파일을 관리합니다.' : '공지를 조회·작성하고 본인이 작성한 글을 수정·삭제할 수 있습니다.'} action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => openEditor(null)}>공지 등록</Button>} />
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}
      <FilterCard><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1.5fr) minmax(160px, 0.5fr) auto' }, gap: 1.5 }}><TextField size="small" label="title" placeholder="공지 제목 검색" value={params.title} onChange={(event) => updateParam('title', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} /><FormControl size="small"><InputLabel>exposeYn</InputLabel><Select label="exposeYn" value={params.exposeYn} onChange={(event) => updateParam('exposeYn', event.target.value as NoticeListParams['exposeYn'])}><MenuItem value="ALL">전체</MenuItem><MenuItem value="Y">노출</MenuItem><MenuItem value="N">숨김</MenuItem></Select></FormControl><Button color="inherit" onClick={() => setParams((current) => ({ ...defaultParams, size: current.size }))}>초기화</Button></Box></FilterCard>
      <Card>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}><Typography sx={{ color: 'text.secondary', fontSize: 14 }}>공지사항 {filteredNotices.length.toLocaleString()}건</Typography><FormControl size="small" sx={{ minWidth: 132 }}><Select value={params.size} onChange={(event) => updateParam('size', Number(event.target.value))} inputProps={{ 'aria-label': '공지사항 페이지당 개수' }}>{[5, 10, 20].map((size) => <MenuItem key={size} value={size}>{size}개씩 보기</MenuItem>)}</Select></FormControl></Box>
        <TableContainer sx={{ maxHeight: params.size === 20 ? 820 : params.size === 10 ? 620 : 440 }}><Table stickyHeader sx={{ minWidth: 980 }}><TableHead><TableRow><TableCell>제목</TableCell><TableCell sx={{ minWidth: 150 }}>노출 상태</TableCell><TableCell>첨부</TableCell><TableCell>조회수</TableCell><TableCell>작성자</TableCell><TableCell>등록일</TableCell><TableCell align="right">관리</TableCell></TableRow></TableHead><TableBody>{pageContent.map((notice) => <TableRow key={notice.noticeUid} hover><TableCell><Typography sx={{ fontWeight: 700 }}>{notice.title}</Typography><Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{notice.noticeUid}</Typography></TableCell><TableCell><Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><StatusBadge status={notice.exposeYn} /><Switch size="small" checked={notice.exposeYn === 'Y'} disabled={!canManage(notice)} onChange={() => toggleExpose(notice)} slotProps={{ input: { 'aria-label': `${notice.title} 노출 상태 변경` } }} /></Stack></TableCell><TableCell><StatusBadge icon={<AttachFileRounded />} label={`${notice.files.length}개`} tone="neutral" minWidth={50} /></TableCell><TableCell>{notice.viewCount.toLocaleString()}</TableCell><TableCell>{notice.createdBy}{notice.createdBy === user?.loginId && <StatusBadge label="내 글" tone="accent" minWidth={46} sx={{ ml: 1 }} />}</TableCell><TableCell>{notice.createdAt.split(' ')[0]}</TableCell><TableCell align="right"><Button size="small" startIcon={<VisibilityRounded />} onClick={() => openDetail(notice)}>상세</Button>{canManage(notice) && <Button size="small" startIcon={<EditRounded />} onClick={() => openEditor(notice)}>수정</Button>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
        <PaginationBar page={params.page} size={params.size} totalElements={filteredNotices.length} onPageChange={(page) => updateParam('page', page)} />
      </Card>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md"><DialogTitle>{detail?.title}</DialogTitle><DialogContent>{detail && <><Stack direction="row" spacing={1} sx={{ mb: 2 }}><StatusBadge status={detail.exposeYn} /><StatusBadge label={`조회 ${detail.viewCount.toLocaleString()}`} tone="neutral" /><StatusBadge label={detail.createdAt} tone="neutral" minWidth={0} /></Stack><Typography sx={{ minHeight: 140, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{detail.content}</Typography><Typography variant="h6" sx={{ mt: 3, mb: 1 }}>암호화 첨부파일</Typography>{detail.files.length === 0 ? <Typography color="text.secondary">첨부파일이 없습니다.</Typography> : <List>{detail.files.map((file) => <ListItem key={file.fileUid} divider secondaryAction={<Stack direction="row" spacing={0.5}><Button size="small" startIcon={<DownloadRounded />} onClick={() => { downloadMockFile(file); setMessage('첨부파일을 마스터키로 복호화해 다운로드하고 FILE_DOWNLOAD 감사로그를 기록했습니다.') }}>복호화 다운로드</Button>{canManage(detail) && <Button color="error" size="small" startIcon={<DeleteOutlineRounded />} onClick={() => deleteFile(file.fileUid)}>삭제</Button>}</Stack>}><ListItemText primary={file.originalName} secondary={`${(file.size / 1024).toFixed(1)} KB · enc_ver ${file.encVer}`} /></ListItem>)}</List>}</>}</DialogContent><DialogActions>{detail && canManage(detail) && <Button color="error" onClick={() => deleteNotice(detail)}>공지 삭제</Button>}<Button onClick={() => setDetail(null)}>닫기</Button></DialogActions></Dialog>

      <Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} fullWidth maxWidth="md"><Box component="form" onSubmit={saveNotice}><DialogTitle>{editor ? '공지 수정' : '공지 등록'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField required label="제목" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /><TextField required multiline minRows={8} label="본문" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /><FormControlLabel control={<Switch checked={form.exposeYn === 'Y'} onChange={(event) => setForm((current) => ({ ...current, exposeYn: event.target.checked ? 'Y' : 'N' }))} />} label="공지 노출" /><Button component="label" variant="outlined" startIcon={<AttachFileRounded />}>다중 첨부파일 선택<input hidden multiple type="file" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></Button>{files.length > 0 && <Alert severity="info">선택한 {files.length}개 파일은 업로드 시 마스터키 AES-256-GCM으로 암호화하고 IV·enc_ver를 저장합니다.</Alert>}</Stack></DialogContent><DialogActions><Button onClick={() => setEditor(undefined)}>취소</Button><Button type="submit" variant="contained" disabled={!form.title.trim() || !form.content.trim()}>저장</Button></DialogActions></Box></Dialog>
    </Box>
  )
}

export default NoticeList
