import { useContext } from 'react'
import { KmsContext } from '../contexts/KmsContext'

export function useKmsMock() {
  const context = useContext(KmsContext)
  if (!context) throw new Error('useKmsMock must be used inside KmsProvider')
  return context
}
