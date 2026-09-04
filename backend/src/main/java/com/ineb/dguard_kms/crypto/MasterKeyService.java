package com.ineb.dguard_kms.crypto;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

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
    public static final int REQUIRED_ITERATIONS = 10_000;
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
        byte[] passphraseBytes = configuredPassphrase.getBytes(StandardCharsets.UTF_8);
        char[] passphrase = configuredPassphrase.toCharArray();
        configuredPassphrase = null;
        try {
            if (passphraseBytes.length < 32) {
                throw new IllegalStateException("KMS master passphrase must contain at least 32 UTF-8 bytes");
            }
            transactionTemplate.executeWithoutResult(status -> initializeInTransaction(passphrase));
        } finally {
            Arrays.fill(passphraseBytes, (byte) 0);
            Arrays.fill(passphrase, '\0');
        }
    }

    private void initializeInTransaction(char[] passphrase) {
        var persistedConfig = configRepository.findFirstByOrderByIdAsc();
        if (configRepository.count() > 1) {
            throw new IllegalStateException("crypto_config must contain exactly one row");
        }

        int configuredIterations = environment.getProperty(
                "kms.master.pbkdf2.iterations", Integer.class, REQUIRED_ITERATIONS
        );
        int keyLength = environment.getProperty("kms.master.pbkdf2.key-length", Integer.class, 256);
        String algorithm = environment.getProperty("kms.master.pbkdf2.algorithm", "PBKDF2WithHmacSHA256");
        validateDerivationPolicy(configuredIterations, keyLength, algorithm);

        try {
            if (persistedConfig.isEmpty()) {
                // 최초 기동은 파생 정책과 KCV를 DB에 저장해 이후 기동의 동일 키 여부를 검증한다.
                byte[] salt = new byte[SALT_LENGTH_BYTES];
                secureRandom.nextBytes(salt);
                byte[] derived = deriveKey(passphrase, salt, configuredIterations, keyLength, algorithm);
                byte[] kcv = createKcv(derived);
                configRepository.save(new CryptoConfigEntry(
                        Base64.getEncoder().encodeToString(salt),
                        Base64.getEncoder().encodeToString(kcv),
                        configuredIterations
                ));
                this.masterKey = derived;
                Arrays.fill(salt, (byte) 0);
                Arrays.fill(kcv, (byte) 0);
                return;
            }

            CryptoConfigEntry config = persistedConfig.orElseThrow();
            byte[] salt = Base64.getDecoder().decode(config.getSalt());
            byte[] expectedKcv = Base64.getDecoder().decode(config.getKcv());
            int storedIterations = config.getIterations();
            int storedKeyLength = keyLength;
            String storedAlgorithm = algorithm;
            validateDerivationPolicy(storedIterations, storedKeyLength, storedAlgorithm);
            byte[] derived = deriveKey(passphrase, salt, storedIterations, storedKeyLength, storedAlgorithm);
            byte[] actualKcv = createKcv(derived);
            Arrays.fill(salt, (byte) 0);
            boolean kcvValid = MessageDigest.isEqual(expectedKcv, actualKcv);
            Arrays.fill(expectedKcv, (byte) 0);
            Arrays.fill(actualKcv, (byte) 0);
            if (!kcvValid) {
                // 잘못된 패스프레이즈로 암호화 키를 다루기 전에 애플리케이션 기동을 중단한다.
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
        if (iterations < REQUIRED_ITERATIONS) {
            throw new IllegalStateException("PBKDF2 iterations must be at least " + REQUIRED_ITERATIONS);
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
        // KCV는 고정 입력의 검증값일 뿐 실제 데이터 암호화에는 항상 임의 IV를 사용한다.
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(GCM_TAG_LENGTH_BITS, KCV_IV));
        return cipher.doFinal(KCV_PLAINTEXT);
    }

    public <T> T withMasterKey(MasterKeyOperation<T> operation) {
        byte[] current = masterKey;
        if (current == null) {
            throw new IllegalStateException("Master key is not initialized");
        }
        // 공유 마스터키 원본을 노출하지 않고 작업별 복사본만 전달한 뒤 즉시 지운다.
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
