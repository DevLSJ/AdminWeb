package com.ineb.dguard_kms.crypto;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;

@Component
public class CryptoUtil {

    public static final int IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    private final MasterKeyService masterKeyService;
    private final SecureRandom secureRandom;

    public CryptoUtil(MasterKeyService masterKeyService, SecureRandom secureRandom) {
        this.masterKeyService = masterKeyService;
        this.secureRandom = secureRandom;
    }

    public EncryptedPayload encrypt(byte[] plaintext) {
        if (plaintext == null) {
            throw new IllegalArgumentException("Plaintext must not be null");
        }
        byte[] iv = new byte[IV_LENGTH_BYTES];
        // AES-GCM은 같은 키에서 IV 재사용이 위험하므로 매 암호화마다 새 IV를 만든다.
        secureRandom.nextBytes(iv);
        return masterKeyService.withMasterKey(key -> encrypt(plaintext, key, iv));
    }

    public byte[] decrypt(EncryptedPayload payload) {
        validatePayload(payload);
        return masterKeyService.withMasterKey(key -> decrypt(payload.ciphertext(), key, payload.iv()));
    }

    public byte[] generateAes256Key() {
        byte[] key = new byte[32];
        secureRandom.nextBytes(key);
        return key;
    }

    public Base64Payload wrapKey(byte[] rawKey) {
        validateAes256Key(rawKey);
        EncryptedPayload wrapped = encrypt(rawKey);
        return toBase64(wrapped);
    }

    public byte[] unwrapKey(Base64Payload wrappedKey) {
        return decrypt(fromBase64(wrappedKey));
    }

    public Base64Payload encryptWithKey(byte[] plaintext, byte[] rawKey) {
        if (plaintext == null) {
            throw new IllegalArgumentException("Plaintext must not be null");
        }
        validateAes256Key(rawKey);
        byte[] iv = new byte[IV_LENGTH_BYTES];
        secureRandom.nextBytes(iv);
        SecretKeySpec key = new SecretKeySpec(rawKey, "AES");
        try {
            return toBase64(encrypt(plaintext, key, iv));
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Cryptographic operation failed", exception);
        }
    }

    public byte[] decryptWithKey(Base64Payload payload, byte[] rawKey) {
        validateAes256Key(rawKey);
        EncryptedPayload decoded = fromBase64(payload);
        try {
            return decrypt(decoded.ciphertext(), new SecretKeySpec(rawKey, "AES"), decoded.iv());
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Cryptographic operation failed", exception);
        }
    }

    public String encodeBase64(byte[] value) {
        if (value == null) throw new IllegalArgumentException("Binary value must not be null");
        return Base64.getEncoder().encodeToString(value);
    }

    public byte[] decodeBase64(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Base64 value must not be blank");
        try {
            return Base64.getDecoder().decode(value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid Base64 value", exception);
        }
    }

    private Base64Payload toBase64(EncryptedPayload payload) {
        return new Base64Payload(encodeBase64(payload.ciphertext()), encodeBase64(payload.iv()));
    }

    private EncryptedPayload fromBase64(Base64Payload payload) {
        if (payload == null) throw new IllegalArgumentException("Encrypted payload must not be null");
        EncryptedPayload decoded = new EncryptedPayload(
                decodeBase64(payload.iv()),
                decodeBase64(payload.ciphertext())
        );
        validatePayload(decoded);
        return decoded;
    }

    private void validatePayload(EncryptedPayload payload) {
        if (payload == null || payload.iv().length != IV_LENGTH_BYTES) {
            throw new IllegalArgumentException("A " + IV_LENGTH_BYTES + "-byte IV is required");
        }
        if (payload.ciphertext().length < 16) {
            throw new IllegalArgumentException("Ciphertext must include a GCM authentication tag");
        }
    }

    private void validateAes256Key(byte[] rawKey) {
        if (rawKey == null || rawKey.length != 32) {
            throw new IllegalArgumentException("A 256-bit AES key is required");
        }
    }

    private EncryptedPayload encrypt(byte[] plaintext, SecretKey key, byte[] iv) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
        return new EncryptedPayload(iv, cipher.doFinal(plaintext));
    }

    private byte[] decrypt(byte[] ciphertext, SecretKey key, byte[] iv) throws GeneralSecurityException {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            return cipher.doFinal(ciphertext);
        } catch (AEADBadTagException exception) {
            throw new CryptoOperationException("Authentication tag verification failed", exception);
        }
    }

    public record EncryptedPayload(byte[] iv, byte[] ciphertext) {
        public EncryptedPayload {
            // 배열의 외부 변경으로 암호문이나 IV가 변조되지 않도록 방어적 복사한다.
            iv = Arrays.copyOf(iv, iv.length);
            ciphertext = Arrays.copyOf(ciphertext, ciphertext.length);
        }

        @Override
        public byte[] iv() {
            return Arrays.copyOf(iv, iv.length);
        }

        @Override
        public byte[] ciphertext() {
            return Arrays.copyOf(ciphertext, ciphertext.length);
        }
    }

    public record Base64Payload(String ciphertext, String iv) {
        public Base64Payload {
            if (ciphertext == null || ciphertext.isBlank() || iv == null || iv.isBlank()) {
                throw new IllegalArgumentException("Base64 ciphertext and IV are required");
            }
        }
    }
}
