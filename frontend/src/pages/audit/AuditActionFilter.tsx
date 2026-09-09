import { FormControl, InputLabel, ListSubheader, MenuItem, Select } from '@mui/material'
import { categoryMenuProps } from '../../components/admin/categoryMenu'
import type { AuditAction, AuditListParams } from '../../types/api'
import { auditActionLabels } from '../../utils/auditPresentation'

interface ActionOption {
  value: AuditListParams['action']
  label: string
  group: string
}

function actionGroup(action: AuditAction) {
  if (action === 'KEY_POLICY_UPDATE' || action === 'COMMON_CODE_UPDATE') return '코드 · 정책'
  if (action.startsWith('KEY_')) return '키 관리'
  if (action.startsWith('USER_')) return '사용자'
  if (action.startsWith('ADMIN_ACCOUNT_')) return '관리 계정'
  if (action.startsWith('NOTICE_') || action.startsWith('FILE_')) return '게시판 · 첨부파일'
  if (action === 'AUDIT_EXPORT') return '감사 로그'
  return '로그인 · 세션'
}

const groups = ['로그인 · 세션', '키 관리', '사용자', '관리 계정', '게시판 · 첨부파일', '감사 로그', '코드 · 정책']
const actions = (Object.keys(auditActionLabels) as AuditAction[]).map((value) => ({
  value, label: auditActionLabels[value], group: actionGroup(value),
}))
const options: ActionOption[] = [
  { value: 'ALL', label: '전체 행위', group: '' },
  ...groups.flatMap((group) => actions.filter((action) => action.group === group)),
]
export function AuditActionFilter({ value, onChange }: {
  value: AuditListParams['action']
  onChange: (value: AuditListParams['action']) => void
}) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel id="audit-action-label">행위 유형</InputLabel>
      <Select
        labelId="audit-action-label"
        id="audit-action"
        label="행위 유형"
        value={value}
        onChange={(event) => onChange(event.target.value as AuditListParams['action'])}
        renderValue={(selected) => options.find((option) => option.value === selected)?.label ?? '전체 행위'}
        MenuProps={categoryMenuProps}
      >
        <MenuItem value="ALL">전체 행위</MenuItem>
        {groups.flatMap((group) => [
          <ListSubheader key={group} sx={{ lineHeight: '32px', mt: .5, borderRadius: 1, bgcolor: 'background.default', color: 'primary.main', fontSize: 12, fontWeight: 800 }}>{group}</ListSubheader>,
          ...actions.filter((action) => action.group === group).map((action) => (
            <MenuItem key={action.value} value={action.value}>{action.label}</MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  )
}
