import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { PageHeader } from '../../components/admin/AdminPage'
import { managementTableSx } from '../../components/admin/managementTable'
import { useAuth } from '../../hooks/useAuth'
import { getApiErrorMessage } from '../../api/kms'
import { refreshKeySettings, saveCommonCode, saveKeyPolicy, useKeySettings, type CommonCode, type KeyPolicy } from '../../stores/keySettings'

export default function KeySettings() {
  const { user } = useAuth()
  const { codes, policy, error: loadError } = useKeySettings()
  const editable = user?.role === 'S.ADMIN'
  const [group, setGroup] = useState<CommonCode['group']>('ALGORITHM')
  const [draft, setDraft] = useState<KeyPolicy | null>(null)
  const [editing, setEditing] = useState<CommonCode | null>(null)
  const [reason, setReason] = useState('')
  const [codeReason, setCodeReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)
  useEffect(() => { void refreshKeySettings().catch(() => {}) }, [])
  // Retain unsaved edits and their version, so an intervening update becomes a visible conflict.
  useEffect(() => { if (!draft && policy) setDraft(policy) }, [policy, draft])
  const save = async (kind: 'policy' | 'code') => {
    setBusy(true); setFeedback(null)
    try {
      if (kind === 'policy' && draft) { await saveKeyPolicy({ defaultValidityDays: draft.defaultValidityDays, expiryWarningDays: draft.expiryWarningDays, version: draft.version }, reason); setDraft(null); setReason('') }
      if (kind === 'code' && editing) { await saveCommonCode(editing, codeReason); setEditing(null); setCodeReason('') }
      setFeedback({ severity: 'success', text: '설정을 저장했습니다.' })
    } catch (error) { setFeedback({ severity: 'error', text: getApiErrorMessage(error, '설정을 저장하지 못했습니다.') }) }
    finally { setBusy(false) }
  }
  return <Box sx={{ height: '100%', overflow: 'auto', pb: 2 }}>
    <PageHeader title="코드·정책 관리" action={<Button disabled={busy} onClick={() => { setDraft(null); void refreshKeySettings().then(result => setDraft(result.policy)).catch(() => {}) }}>새로고침</Button>} />
    {(feedback || loadError) && <Alert sx={{ mb: 2 }} severity={feedback?.severity ?? 'error'}>{feedback?.text ?? loadError}</Alert>}
    <Card className="section-card" sx={{ mb: 2.5 }}>
      <Box className="section-card-header"><Typography variant="h6">키 운영 정책</Typography></Box>
      <CardContent>
        <Stack component="form" onSubmit={event => { event.preventDefault(); void save('policy') }} spacing={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <TextField label="기본 유효기간(일)" type="number" size="small" required disabled={!editable || busy || !draft} value={draft?.defaultValidityDays ?? ''} onChange={event => setDraft(current => current && ({ ...current, defaultValidityDays: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 1, max: 3650, step: 1 } }} helperText="새로 등록하는 키의 기본 만료일에 적용됩니다. 기존 키의 만료일은 유지됩니다." />
            <TextField label="만료 알림일(만료 전 일수)" type="number" size="small" required disabled={!editable || busy || !draft} value={draft?.expiryWarningDays ?? ''} onChange={event => setDraft(current => current && ({ ...current, expiryWarningDays: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 1, max: 365, step: 1 } }} helperText="활성 키의 대시보드 경고와 키 목록 강조에 적용됩니다." />
          </Box>
          {editable && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="정책 변경 사유" size="small" fullWidth required disabled={busy} value={reason} onChange={event => setReason(event.target.value)} slotProps={{ htmlInput: { minLength: 2, maxLength: 200 } }} /><Button type="submit" variant="contained" disabled={busy || !draft || reason.trim().length < 2} sx={{ flexShrink: 0 }}>정책 저장</Button></Stack>}
          {!editable && <Typography color="text.secondary" sx={{ fontSize: 12 }}>설정 변경은 최고관리자만 가능합니다.</Typography>}
        </Stack>
      </CardContent>
    </Card>
    <Card className="section-card">
      <Tabs value={group} onChange={(_event, value) => setGroup(value)} aria-label="공통코드 그룹"><Tab value="ALGORITHM" label="알고리즘" /><Tab value="PURPOSE" label="용도" /><Tab value="STATUS" label="상태" /></Tabs>
      <TableContainer><Table size="small" sx={{ ...managementTableSx, minWidth: 850 }}>
        <TableHead><TableRow><TableCell>순서</TableCell><TableCell>코드</TableCell><TableCell>표시명</TableCell><TableCell>설명</TableCell><TableCell>{group === 'STATUS' ? '허용 전이' : '신규 선택'}</TableCell><TableCell align="center">관리</TableCell></TableRow></TableHead>
        <TableBody>{codes.filter(code => code.group === group).map(code => <TableRow key={code.code} hover><TableCell>{code.sortOrder}</TableCell><TableCell>{code.code}</TableCell><TableCell>{code.label}</TableCell><TableCell>{code.description}</TableCell><TableCell>{group === 'STATUS' ? code.allowedTransitions.join(', ') || '없음' : !code.selectable ? '조회 전용' : code.enabled ? '허용' : '중지'}</TableCell><TableCell align="center"><Button size="small" disabled={!editable} onClick={() => { setEditing({ ...code }); setCodeReason(''); setFeedback(null) }}>수정</Button></TableCell></TableRow>)}</TableBody>
      </Table></TableContainer>
    </Card>
    <Dialog open={Boolean(editing)} onClose={() => { if (!busy) setEditing(null) }} fullWidth maxWidth="sm">
      <DialogTitle>공통코드 수정 · {editing?.code}</DialogTitle>
      <DialogContent dividers><Stack id="code-settings-form" component="form" spacing={2} onSubmit={event => { event.preventDefault(); void save('code') }}>
        {feedback?.severity === 'error' && <Alert severity="error">{feedback.text}</Alert>}
        <TextField label="표시명" required size="small" disabled={busy} value={editing?.label ?? ''} onChange={event => setEditing(current => current && ({ ...current, label: event.target.value }))} slotProps={{ htmlInput: { maxLength: 80 } }} />
        <TextField label="설명" size="small" disabled={busy} value={editing?.description ?? ''} onChange={event => setEditing(current => current && ({ ...current, description: event.target.value }))} slotProps={{ htmlInput: { maxLength: 200 } }} />
        <TextField label="정렬 순서" type="number" size="small" required disabled={busy} value={editing?.sortOrder ?? 0} onChange={event => setEditing(current => current && ({ ...current, sortOrder: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 0, max: 999, step: 1 } }} />
        {editing?.group !== 'STATUS' && <FormControlLabel control={<Switch checked={editing?.enabled ?? false} disabled={busy || !editing?.selectable} onChange={(_event, enabled) => setEditing(current => current && ({ ...current, enabled }))} />} label="신규 선택 허용" />}
        <TextField label="코드 변경 사유" required size="small" disabled={busy} value={codeReason} onChange={event => setCodeReason(event.target.value)} slotProps={{ htmlInput: { minLength: 2, maxLength: 200 } }} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setEditing(null)}>취소</Button><Button form="code-settings-form" type="submit" variant="contained" disabled={busy || codeReason.trim().length < 2}>저장</Button></DialogActions>
    </Dialog>
  </Box>
}
