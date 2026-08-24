package com.ineb.dguard_kms.crypto;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.ineb.dguard_kms.domain.config.entity.CryptoConfigEntry;
import com.ineb.dguard_kms.domain.config.repository.CryptoConfigRepository;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Service
public class MasterKeyService {

    private static final Logger log = LoggerFactory.getLogger(MasterKeyService.class);
    private static final String SALT_CONFIG_KEY = "master.salt";
    private static final String KCV_CONFIG_KEY = "master.kcv";
    private static final String ITERATIONS_CONFIG_KEY = "master.iterations";
    private static final String ALGORITHM_CONFIG_KEY = "master.algorithm";
    private static final String KEY_LENGTH_CONFIG_KEY = "master.key-length";
    private static final int MINIMUM_ITERATIONS = 210_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final byte[] KCV_IV = new byte[16];
    private static final byte[] KCV_PLAINTEXT = "KMS-KCV-V1".getBytes(StandardCharsets.UTF_8);

    private final CryptoConfigRepository configRepository;
    private final TransactionTemplate transactionTemplate;
    private final SecureRandom secureRandom;
    private final Environment environment;
    private volatile byte[] masterKey;

    public MasterKeyService(
            CryptoConfigRepository configRepository,
            TransactionTemplate transactionTemplate,
            SecureRandom secureRandom,
            Environment environment
    ) {
        this.configRepository = configRepository;
        this.transactionTemplate = transactionTemplate;
        this.secureRandom = secureRandom;
        this.environment = environment;
    }

    @PostConstruct
    void initialize() {
        String configuredPassphrase = environment.getRequiredProperty("kms.master.passphrase");
        char[] passphrase = configuredPassphrase.toCharArray();
        configuredPassphrase = null;
        try {
            if (passphrase.length < 20) {
                throw new IllegalStateException("KMS master passphrase must contain at least 20 characters");
            }
            transactionTemplate.executeWithoutResult(status -> initializeInTransaction(passphrase));
        } finally {
            Arrays.fill(passphrase, '\0');
        }
    }

    private void initializeInTransaction(char[] passphrase) {
        var saltEntry = configRepository.findById(SALT_CONFIG_KEY);
        var kcvEntry = configRepository.findById(KCV_CONFIG_KEY);
        if (saltEntry.isEmpty() != kcvEntry.isEmpty()) {
            throw new IllegalStateException("Master key configuration is incomplete");
        }

        int configuredIterations = environment.getProperty("kms.master.pbkdf2.iterations", Integer.class, 210_000);
        int keyLength = environment.getProperty("kms.master.pbkdf2.key-length", Integer.class, 256);
        String algorithm = environment.getProperty("kms.master.pbkdf2.algorithm", "PBKDF2WithHmacSHA256");
        validateDerivationPolicy(configuredIterations, keyLength, algorithm);

        try {
            if (saltEntry.isEmpty()) {
                byte[] salt = new byte[SALT_LENGTH_BYTES];
                secureRandom.nextBytes(salt);
                byte[] derived = deriveKey(passphrase, salt, configuredIterations, keyLength, algorithm);
                byte[] kcv = createKcv(derived);
                configRepository.saveAll(List.of(
                        new CryptoConfigEntry(SALT_CONFIG_KEY, Base64.getEncoder().encodeToString(salt)),
                        new CryptoConfigEntry(KCV_CONFIG_KEY, Base64.getEncoder().encodeToString(kcv)),
                        new CryptoConfigEntry(ITERATIONS_CONFIG_KEY, Integer.toString(configuredIterations)),
                        new CryptoConfigEntry(ALGORITHM_CONFIG_KEY, algorithm),
                        new CryptoConfigEntry(KEY_LENGTH_CONFIG_KEY, Integer.toString(keyLength))
                ));
                this.masterKey = derived;
                Arrays.fill(salt, (byte) 0);
                Arrays.fill(kcv, (byte) 0);
                return;
            }

            byte[] salt = Base64.getDecoder().decode(saltEntry.orElseThrow().getConfigValue());
            byte[] expectedKcv = Base64.getDecoder().decode(kcvEntry.orElseThrow().getConfigValue());
            int storedIterations = configRepository.findById(ITERATIONS_CONFIG_KEY)
                    .map(CryptoConfigEntry::getConfigValue)
                    .map(Integer::parseInt)
                    .orElse(configuredIterations);
            int storedKeyLength = configRepository.findById(KEY_LENGTH_CONFIG_KEY)
                    .map(CryptoConfigEntry::getConfigValue)
                    .map(Integer::parseInt)
                    .orElse(keyLength);
            String storedAlgorithm = configRepository.findById(ALGORITHM_CONFIG_KEY)
                    .map(CryptoConfigEntry::getConfigValue)
                    .orElse(algorithm);
            validateDerivationPolicy(storedIterations, storedKeyLength, storedAlgorithm);
            byte[] derived = deriveKey(passphrase, salt, storedIterations, storedKeyLength, storedAlgorithm);
            byte[] actualKcv = createKcv(derived);
            Arrays.fill(salt, (byte) 0);
            boolean kcvValid = MessageDigest.isEqual(expectedKcv, actualKcv);
            Arrays.fill(expectedKcv, (byte) 0);
            Arrays.fill(actualKcv, (byte) 0);
            if (!kcvValid) {
                Arrays.fill(derived, (byte) 0);
                log.error(
                        "KCV verification failed: the configured KMS master passphrase does not match "
                                + "the persisted master key configuration. Application startup is aborted."
                );
                throw new IllegalStateException("Master key KCV verification failed");
            }
            this.masterKey = derived;
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("Unable to initialize the KMS master key", exception);
        }
    }

    private void validateDerivationPolicy(int iterations, int keyLength, String algorithm) {
        if (iterations < MINIMUM_ITERATIONS) {
            throw new IllegalStateException("PBKDF2 iterations must be at least " + MINIMUM_ITERATIONS);
        }
        if (keyLength != 256 || !"PBKDF2WithHmacSHA256".equals(algorithm)) {
            throw new IllegalStateException("Master key derivation must use PBKDF2-HMAC-SHA256 with a 256-bit output");
        }
    }

    private byte[] deriveKey(char[] passphrase, byte[] salt, int iterations, int keyLength, String algorithm)
            throws GeneralSecurityException {
        PBEKeySpec keySpec = new PBEKeySpec(passphrase, salt, iterations, keyLength);
        try {
            return SecretKeyFactory.getInstance(algorithm).generateSecret(keySpec).getEncoded();
        } finally {
            keySpec.clearPassword();
        }
    }

    private byte[] createKcv(byte[] key) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(GCM_TAG_LENGTH_BITS, KCV_IV));
        return cipher.doFinal(KCV_PLAINTEXT);
    }

    public <T> T withMasterKey(MasterKeyOperation<T> operation) {
        byte[] current = masterKey;
        if (current == null) {
            throw new IllegalStateException("Master key is not initialized");
        }
        byte[] copy = current.clone();
        try {
            return operation.apply(new SecretKeySpec(copy, "AES"));
        } catch (GeneralSecurityException exception) {
            throw new CryptoOperationException("Cryptographic operation failed", exception);
        } finally {
            Arrays.fill(copy, (byte) 0);
        }
    }

    @PreDestroy
    void destroy() {
        byte[] current = masterKey;
        masterKey = null;
        if (current != null) {
            Arrays.fill(current, (byte) 0);
        }
    }

    @FunctionalInterface
    public interface MasterKeyOperation<T> {
        T apply(SecretKey masterKey) throws GeneralSecurityException;
    }
}
