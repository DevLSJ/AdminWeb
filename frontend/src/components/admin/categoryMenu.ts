import type { MenuProps } from '@mui/material'

// 감사 로그, 게시글, 키 목록에서 사용하는 카테고리 메뉴의 공통 표시 규칙.
export const categoryMenuProps: Partial<MenuProps> = {
  slotProps: {
    paper: {
      sx: { mt: .75, maxHeight: 400, border: '1px solid', borderColor: 'divider', borderRadius: 2 },
    },
    list: {
      sx: { p: .75, '& .MuiMenuItem-root': { minHeight: 40, borderRadius: 1, fontSize: 14, whiteSpace: 'normal' } },
    },
  },
}
