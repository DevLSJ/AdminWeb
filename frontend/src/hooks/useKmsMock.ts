import { useContext } from 'react'
import { KmsMockContext } from '../contexts/KmsMockContext'

export function useKmsMock() {
  const context = useContext(KmsMockContext)
  if (!context) throw new Error('useKmsMock must be used inside KmsMockProvider')
  return context
}
