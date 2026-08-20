const AES_KEY_LENGTH = 256
const IV_LENGTH = 16
const GCM_TAG_LENGTH = 16

export const DECRYPT_FAILURE_MESSAGE = '복호화 실패: 올바르지 않은 IV 또는 암호문입니다.'

interface WrappedManagedKey {
  wrappedKey: ArrayBuffer
  wrappingIv: Uint8Array<ArrayBuffer>
}

export interface EncryptionResult {
  ciphertext: string
  iv: string
}

const wrappedManagedKeys = new Map<string, Promise<WrappedManagedKey>>()
let masterKey: Promise<CryptoKey> | undefined

function getMasterKey() {
  if (!crypto.subtle) throw new Error('Web Crypto is unavailable')
  masterKey ??= crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  ) as Promise<CryptoKey>
  return masterKey
}

function randomIv() {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function fromBase64(value: string) {
  const normalized = value.trim()
  const validBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
  if (!normalized || normalized.length % 4 !== 0 || !validBase64.test(normalized)) {
    throw new Error('Invalid Base64')
  }

  const binary = atob(normalized)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

function splitCiphertext(value: string) {
  const combined = fromBase64(value)
  if (combined.length < IV_LENGTH + GCM_TAG_LENGTH) {
    throw new Error('Ciphertext is too short')
  }

  return {
    embeddedIv: combined.slice(0, IV_LENGTH),
    encrypted: combined.slice(IV_LENGTH),
  }
}

async function createWrappedManagedKey(): Promise<WrappedManagedKey> {
  const rawKey = crypto.getRandomValues(new Uint8Array(AES_KEY_LENGTH / 8))
  const wrappingIv = randomIv()
  try {
    const wrappedKey = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: wrappingIv, tagLength: 128 },
      await getMasterKey(),
      rawKey,
    )
    return { wrappedKey, wrappingIv }
  } finally {
    rawKey.fill(0)
  }
}

async function getManagedKey(keyUid: string) {
  let wrapped = wrappedManagedKeys.get(keyUid)
  if (!wrapped) {
    wrapped = createWrappedManagedKey()
    wrappedManagedKeys.set(keyUid, wrapped)
  }

  const material = await wrapped
  const rawKey = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: material.wrappingIv, tagLength: 128 },
    await getMasterKey(),
    material.wrappedKey,
  ))

  try {
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      false,
      ['encrypt', 'decrypt'],
    )
  } finally {
    rawKey.fill(0)
  }
}

export function isMatchingCiphertextIv(ciphertextBase64: string, ivBase64: string) {
  try {
    const { embeddedIv } = splitCiphertext(ciphertextBase64)
    const suppliedIv = fromBase64(ivBase64)
    return suppliedIv.length === IV_LENGTH && sameBytes(embeddedIv, suppliedIv)
  } catch {
    return false
  }
}

export async function encryptWithManagedKey(keyUid: string, plaintext: string): Promise<EncryptionResult> {
  const iv = randomIv()
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    await getManagedKey(keyUid),
    new TextEncoder().encode(plaintext),
  ))
  const combined = new Uint8Array(iv.length + encrypted.length)
  combined.set(iv)
  combined.set(encrypted, iv.length)

  return {
    ciphertext: toBase64(combined),
    iv: toBase64(iv),
  }
}

export async function decryptWithManagedKey(keyUid: string, ciphertextBase64: string, ivBase64?: string) {
  try {
    const { embeddedIv, encrypted } = splitCiphertext(ciphertextBase64)
    if (ivBase64?.trim()) {
      const suppliedIv = fromBase64(ivBase64)
      if (suppliedIv.length !== IV_LENGTH || !sameBytes(embeddedIv, suppliedIv)) {
        throw new Error('IV mismatch')
      }
    }

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: embeddedIv, tagLength: 128 },
      await getManagedKey(keyUid),
      encrypted,
    )
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    throw new Error(DECRYPT_FAILURE_MESSAGE)
  }
}
