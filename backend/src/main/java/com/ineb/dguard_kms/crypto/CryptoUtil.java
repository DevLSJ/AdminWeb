package com.ineb.dguard_kms.crypto;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import org.springframework.stereotype.Component;

@Component
public class CryptoUtil {

    public static final int IV_LENGTH_BYTES = 16;
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
        secureRandom.nextBytes(iv);
        return masterKeyService.withMasterKey(key -> encrypt(plaintext, key, iv));
    }

    public byte[] decrypt(EncryptedPayload payload) {
        if (payload == null || payload.iv().length != IV_LENGTH_BYTES) {
            throw new IllegalArgumentException("A 16-byte IV is required");
        }
        return masterKeyService.withMasterKey(key -> decrypt(payload.ciphertext(), key, payload.iv()));
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
}
