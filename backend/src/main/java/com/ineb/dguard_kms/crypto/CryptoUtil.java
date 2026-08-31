package com.ineb.dguard_kms.crypto;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.security.spec.MGF1ParameterSpec;

import org.springframework.stereotype.Component;

@Component
public class CryptoUtil {

    public static final int IV_LENGTH_BYTES = 12;
    public static final int LEGACY_IV_LENGTH_BYTES = 16;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int CBC_MAC_LENGTH_BYTES = 32;
    private static final byte[] CBC_MAC_DERIVATION_LABEL = "DGUARD-CBC-MAC-V1".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    private static final OAEPParameterSpec RSA_OAEP_SHA256 = new OAEPParameterSpec(
            "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT
    );

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
        return generateAesKey(256);
    }

    public byte[] generateAesKey(int keySize) {
        if (keySize != 128 && keySize != 192 && keySize != 256) {
            throw new IllegalArgumentException("AES key size must be 128, 192, or 256 bits");
        }
        byte[] key = new byte[keySize / Byte.SIZE];
        secureRandom.nextBytes(key);
        return key;
    }

    public KeyPair generateRsaKeyPair(int keySize) {
        if (keySize != 2048 && keySize != 3072 && keySize != 4096) {
            throw new IllegalArgumentException("RSA key size must be 2048, 3072, or 4096 bits");
        }
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(keySize, secureRandom);
            return generator.generateKeyPair();
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Unable to generate RSA key pair", exception);
        }
    }

    public Base64Payload wrapKey(byte[] rawKey) {
        if (rawKey == null || rawKey.length == 0) {
            throw new IllegalArgumentException("Key material must not be empty");
        }
        EncryptedPayload wrapped = encrypt(rawKey);
        return toBase64(wrapped);
    }

    public byte[] unwrapKey(Base64Payload wrappedKey) {
        return decrypt(fromBase64(wrappedKey));
    }

    public Base64Payload encryptWithKey(byte[] plaintext, byte[] rawKey) {
        return encryptAes(plaintext, rawKey, "GCM");
    }

    public Base64Payload encryptAes(byte[] plaintext, byte[] rawKey, String mode) {
        if (plaintext == null) {
            throw new IllegalArgumentException("Plaintext must not be null");
        }
        validateAesKey(rawKey);
        String normalizedMode = normalizeAesMode(mode);
        byte[] iv = new byte["GCM".equals(normalizedMode) ? IV_LENGTH_BYTES : 16];
        secureRandom.nextBytes(iv);
        SecretKeySpec key = new SecretKeySpec(rawKey, "AES");
        try {
            if ("GCM".equals(normalizedMode)) {
                return toBase64(encrypt(plaintext, key, iv));
            }
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new IvParameterSpec(iv));
            byte[] encrypted = cipher.doFinal(plaintext);
            byte[] tag = hmacSha256(rawKey, iv, encrypted);
            byte[] authenticatedCiphertext = new byte[encrypted.length + tag.length];
            System.arraycopy(encrypted, 0, authenticatedCiphertext, 0, encrypted.length);
            System.arraycopy(tag, 0, authenticatedCiphertext, encrypted.length, tag.length);
            Arrays.fill(encrypted, (byte) 0);
            Arrays.fill(tag, (byte) 0);
            return toBase64(new EncryptedPayload(iv, authenticatedCiphertext));
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Cryptographic operation failed", exception);
        }
    }

    public byte[] decryptWithKey(Base64Payload payload, byte[] rawKey) {
        return decryptAes(payload, rawKey, "GCM");
    }

    public byte[] decryptAes(Base64Payload payload, byte[] rawKey, String mode) {
        validateAesKey(rawKey);
        String normalizedMode = normalizeAesMode(mode);
        EncryptedPayload decoded = fromBase64(payload);
        try {
            if ("GCM".equals(normalizedMode)) {
                return decrypt(decoded.ciphertext(), new SecretKeySpec(rawKey, "AES"), decoded.iv());
            }
            if (decoded.iv().length != 16) throw new IllegalArgumentException("AES-CBC requires a 16-byte IV");
            if (decoded.ciphertext().length <= CBC_MAC_LENGTH_BYTES) {
                throw new IllegalArgumentException("AES-CBC ciphertext must include an HMAC tag");
            }
            byte[] authenticated = decoded.ciphertext();
            byte[] encrypted = Arrays.copyOf(authenticated, authenticated.length - CBC_MAC_LENGTH_BYTES);
            byte[] expectedTag = Arrays.copyOfRange(
                    authenticated, authenticated.length - CBC_MAC_LENGTH_BYTES, authenticated.length
            );
            byte[] actualTag = hmacSha256(rawKey, decoded.iv(), encrypted);
            boolean validTag = MessageDigest.isEqual(expectedTag, actualTag);
            Arrays.fill(expectedTag, (byte) 0);
            Arrays.fill(actualTag, (byte) 0);
            if (!validTag) {
                Arrays.fill(encrypted, (byte) 0);
                throw new CryptoOperationException("AES-CBC authentication failed");
            }
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(rawKey, "AES"), new IvParameterSpec(decoded.iv()));
            try {
                return cipher.doFinal(encrypted);
            } finally {
                Arrays.fill(encrypted, (byte) 0);
            }
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Cryptographic operation failed", exception);
        }
    }

    public String encryptRsa(byte[] plaintext, String encodedPublicKey) {
        if (plaintext == null || encodedPublicKey == null || encodedPublicKey.isBlank()) {
            throw new IllegalArgumentException("Plaintext and RSA public key are required");
        }
        try {
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(
                    new X509EncodedKeySpec(decodeBase64(encodedPublicKey))
            );
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.ENCRYPT_MODE, publicKey, RSA_OAEP_SHA256, secureRandom);
            return encodeBase64(cipher.doFinal(plaintext));
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("RSA encryption failed", exception);
        }
    }

    public byte[] decryptRsa(String ciphertext, byte[] encodedPrivateKey) {
        if (encodedPrivateKey == null) throw new IllegalArgumentException("RSA private key is required");
        try {
            PrivateKey privateKey = KeyFactory.getInstance("RSA").generatePrivate(
                    new PKCS8EncodedKeySpec(encodedPrivateKey)
            );
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.DECRYPT_MODE, privateKey, RSA_OAEP_SHA256);
            return cipher.doFinal(decodeBase64(ciphertext));
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("RSA decryption failed", exception);
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
        if (payload == null || (payload.iv().length != IV_LENGTH_BYTES
                && payload.iv().length != LEGACY_IV_LENGTH_BYTES)) {
            throw new IllegalArgumentException("A 12-byte IV is required (legacy 16-byte IV is accepted for migration)");
        }
        if (payload.ciphertext().length < 16) {
            throw new IllegalArgumentException("Ciphertext must include a GCM authentication tag");
        }
    }

    private void validateAesKey(byte[] rawKey) {
        if (rawKey == null || (rawKey.length != 16 && rawKey.length != 24 && rawKey.length != 32)) {
            throw new IllegalArgumentException("An AES-128, AES-192, or AES-256 key is required");
        }
    }

    private String normalizeAesMode(String mode) {
        String normalized = mode == null ? "GCM" : mode.trim().toUpperCase(java.util.Locale.ROOT);
        if (!"GCM".equals(normalized) && !"CBC".equals(normalized)) {
            throw new IllegalArgumentException("AES mode must be GCM or CBC");
        }
        return normalized;
    }

    private byte[] hmacSha256(byte[] key, byte[] iv, byte[] ciphertext) throws GeneralSecurityException {
        Mac derivation = Mac.getInstance("HmacSHA256");
        derivation.init(new SecretKeySpec(key, "HmacSHA256"));
        byte[] macKey = derivation.doFinal(CBC_MAC_DERIVATION_LABEL);
        Mac mac = Mac.getInstance("HmacSHA256");
        try {
            mac.init(new SecretKeySpec(macKey, "HmacSHA256"));
            mac.update(iv);
            mac.update(ciphertext);
            return mac.doFinal();
        } finally {
            Arrays.fill(macKey, (byte) 0);
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
