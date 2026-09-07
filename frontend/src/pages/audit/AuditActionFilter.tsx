import { Autocomplete, Box, TextField, Typography, createFilterOptions } from '@mui/material'
import { CheckRounded, FilterAltOutlined } from '@mui/icons-material'
import type { AuditAction, AuditListParams } from '../../types/api'
import { auditActionLabels } from '../../utils/auditPresentation'

interface ActionOption {
  value: AuditListParams['action']
  label: string
  group: string
}

function actionGroup(action: AuditAction) {
  if (action.startsWith('KEY_')) return '키 관리'
  if (action.startsWith('USER_')) return '사용자'
  if (action.startsWith('ADMIN_ACCOUNT_')) return '관리 계정'
  if (action.startsWith('NOTICE_') || action.startsWith('FILE_')) return '게시판 · 첨부파일'
  if (action === 'AUDIT_EXPORT') return '감사 로그'
  return '로그인 · 세션'
}

const groups = ['로그인 · 세션', '키 관리', '사용자', '관리 계정', '게시판 · 첨부파일', '감사 로그']
const actions = (Object.keys(auditActionLabels) as AuditAction[]).map((value) => ({
  value, label: auditActionLabels[value], group: actionGroup(value),
}))
const options: ActionOption[] = [
  { value: 'ALL', label: '전체 행위', group: '' },
  ...groups.flatMap((group) => actions.filter((action) => action.group === group)),
]
const filterOptions = createFilterOptions<ActionOption>({
  stringify: (option) => `${option.label} ${option.group} ${option.value}`,
})

export function AuditActionFilter({ value, onChange }: {
  value: AuditListParams['action']
  onChange: (value: AuditListParams['action']) => void
}) {
  return (
    <Autocomplete
      size="small"
      options={options}
      value={options.find((option) => option.value === value) ?? options[0]}
      onChange={(_, option) => onChange(option?.value ?? 'ALL')}
      groupBy={(option) => option.group}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      filterOptions={filterOptions}
      autoHighlight
      clearText="전체 행위로 초기화"
      openText="행위 유형 선택"
      closeText="행위 유형 닫기"
      noOptionsText="일치하는 행위가 없습니다."
      slotProps={{
        paper: { sx: { mt: .75, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: '0 12px 32px rgba(25,42,78,.15)' } },
        listbox: { sx: { maxHeight: 360, p: .75, '& .MuiAutocomplete-option': { minHeight: 40, borderRadius: 1, px: 1.5, py: 1 } } },
      }}
      renderGroup={({ key, group, children }) => (
        <li key={key}>
          {group && <Typography component="div" sx={{ px: 1.5, py: .8, mt: .5, borderRadius: 1, bgcolor: 'action.hover', color: 'primary.main', fontSize: 12, fontWeight: 800 }}>{group}</Typography>}
          <Box component="ul" sx={{ m: 0, p: 0 }}>{children}</Box>
        </li>
      )}
      renderOption={({ key, ...props }, option, { selected }) => (
        <Box component="li" key={key} {...props}>
          <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: selected ? 750 : 500, overflowWrap: 'anywhere' }}>{option.label}</Typography>
          {selected && <CheckRounded sx={{ ml: 1, fontSize: 18, color: 'primary.main' }} />}
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} label="행위 유형" placeholder="행위 검색"
          slotProps={{ ...params.slotProps, input: { ...params.slotProps.input, startAdornment: <FilterAltOutlined sx={{ mr: .5, color: 'text.secondary', fontSize: 20 }} /> } }}
        />
      )}
    />
  )
}
