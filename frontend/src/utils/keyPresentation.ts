import type { CryptoKey, KeyAlgorithm, KeyMode } from '../types/api'

export function getKeyAlgorithmLabel(key: Pick<CryptoKey, 'algorithm' | 'keySize' | 'mode'> | { algorithm: KeyAlgorithm; keySize: number; mode: KeyMode }) {
  if (key.algorithm === 'AES') return `AES-${key.keySize}-${key.mode}`
  if (key.algorithm === 'RSA') return `RSA-${key.keySize}-SHA256`
  return 'HMAC-SHA256'
}

export function getKeyCategoryLabel(algorithm: KeyAlgorithm) {
  if (algorithm === 'AES') return '대칭키'
  if (algorithm === 'RSA') return '공개키'
  return '메시지 인증키'
}
