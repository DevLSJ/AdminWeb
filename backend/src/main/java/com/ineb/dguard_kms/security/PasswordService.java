package com.ineb.dguard_kms.security;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

@Service
public class PasswordService {

    public static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int HASH_LENGTH_BITS = 256;

    private final SecureRandom secureRandom;
    private final int defaultIterations;

    public PasswordService(SecureRandom secureRandom, Environment environment) {
        this.secureRandom = secureRandom;
        this.defaultIterations = environment.getProperty("kms.password.pbkdf2.iterations", Integer.class, 210_000);
    }

    public PasswordHash hash(char[] password) {
        byte[] salt = new byte[SALT_LENGTH_BYTES];
        secureRandom.nextBytes(salt);
        byte[] hash = derive(password, salt, defaultIterations, ALGORITHM);
        try {
            return new PasswordHash(
                    Base64.getEncoder().encodeToString(hash),
                    Base64.getEncoder().encodeToString(salt),
                    ALGORITHM,
                    defaultIterations
            );
        } finally {
            Arrays.fill(hash, (byte) 0);
            Arrays.fill(salt, (byte) 0);
        }
    }

    public boolean matches(char[] candidate, AdminUser user) {
        byte[] salt;
        byte[] expected;
        try {
            salt = Base64.getDecoder().decode(user.getPasswordSalt());
            expected = Base64.getDecoder().decode(user.getPasswordHash());
        } catch (IllegalArgumentException exception) {
            return false;
        }

        byte[] actual = null;
        try {
            actual = derive(candidate, salt, user.getPasswordIterations(), user.getPasswordAlgorithm());
            return MessageDigest.isEqual(expected, actual);
        } finally {
            Arrays.fill(salt, (byte) 0);
            Arrays.fill(expected, (byte) 0);
            if (actual != null) Arrays.fill(actual, (byte) 0);
        }
    }

    private byte[] derive(char[] password, byte[] salt, int iterations, String algorithm) {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, HASH_LENGTH_BITS);
        try {
            return SecretKeyFactory.getInstance(algorithm).generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to hash password", exception);
        } finally {
            spec.clearPassword();
        }
    }

    public record PasswordHash(String hash, String salt, String algorithm, int iterations) {
    }
}
