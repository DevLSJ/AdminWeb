package com.ineb.dguard_kms.domain.key.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.crypto.IntegrityService;
import com.ineb.dguard_kms.domain.key.dto.KeyCreateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyHistoryResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyRotationResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyStatusChangeRequest;
import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.entity.KeyStatusHistory;
import com.ineb.dguard_kms.domain.key.entity.KeyUsageLog;
import com.ineb.dguard_kms.domain.key.repository.CryptoKeyRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyMaterialRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyStatusHistoryRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyUsageLogRepository;

@Service
public class CryptoKeyService {

    private static final Map<KeyStatus, Set<KeyStatus>> ALLOWED_TRANSITIONS = createTransitions();

    private final CryptoKeyRepository keyRepository;
    private final KeyMaterialRepository materialRepository;
    private final KeyStatusHistoryRepository historyRepository;
    private final KeyUsageLogRepository usageLogRepository;
    private final CryptoUtil cryptoUtil;
    private final IntegrityService integrityService;

    public CryptoKeyService(
            CryptoKeyRepository keyRepository,
            KeyMaterialRepository materialRepository,
            KeyStatusHistoryRepository historyRepository,
            KeyUsageLogRepository usageLogRepository,
            CryptoUtil cryptoUtil,
            IntegrityService integrityService
    ) {
        this.keyRepository = keyRepository;
        this.materialRepository = materialRepository;
        this.historyRepository = historyRepository;
        this.usageLogRepository = usageLogRepository;
        this.cryptoUtil = cryptoUtil;
        this.integrityService = integrityService;
    }

    @Transactional
    public KeyResponse create(KeyCreateRequest request, String actor) {
        validateManagedKeyPolicy(request.algorithm(), request.keySize());
        if (keyRepository.existsByKeyName(request.keyName().trim())) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        }

        byte[] rawKey = cryptoUtil.generateAes256Key();
        try {
            CryptoUtil.Base64Payload wrapped = cryptoUtil.wrapKey(rawKey);
            CryptoKey key = new CryptoKey(
                    request.keyName().trim(), "AES", 256, request.purpose().trim(), request.expireAt()
            );
            KeyMaterial material = new KeyMaterial(key, 1, wrapped.ciphertext(), wrapped.iv());
            signIntegrity(key, material);
            keyRepository.save(key);
            materialRepository.save(material);
            historyRepository.save(new KeyStatusHistory(
                    key, null, KeyStatus.CREATED, "키 최초 생성", actor
            ));
            return KeyResponse.from(key, true);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        } finally {
            Arrays.fill(rawKey, (byte) 0);
        }
    }

    @Transactional(readOnly = true)
    public List<KeyResponse> findAll() {
        return keyRepository.findAll().stream().map(this::responseWithIntegrity).toList();
    }

    @Transactional(readOnly = true)
    public KeyResponse find(UUID keyUid) {
        return responseWithIntegrity(findKey(keyUid));
    }

    @Transactional(readOnly = true)
    public List<KeyHistoryResponse> history(UUID keyUid) {
        CryptoKey key = findKey(keyUid);
        return historyRepository.findAllByCryptoKeyOrderByChangedAtDesc(key).stream()
                .map(KeyHistoryResponse::from)
                .toList();
    }

    @Transactional
    public KeyResponse changeStatus(UUID keyUid, KeyStatusChangeRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        KeyMaterial material = verifiedCurrentMaterial(key);
        KeyStatus from = key.getStatus();
        KeyStatus to = request.toStatus();
        if (to == KeyStatus.DISTRIBUTED) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "DISTRIBUTED 전이는 키 배포 API를 사용해야 합니다.",
                    "USE_DISTRIBUTION_ENDPOINT"
            );
        }
        if (!ALLOWED_TRANSITIONS.getOrDefault(from, Set.of()).contains(to)) {
            throw conflict("허용되지 않은 키 상태 전이입니다: " + from + " -> " + to, "INVALID_KEY_STATUS_TRANSITION");
        }
        key.changeStatus(to);
        signIntegrity(key, material);
        historyRepository.save(new KeyStatusHistory(key, from, to, request.reason().trim(), actor));
        return KeyResponse.from(key, true);
    }

    @Transactional
    public KeyRotationResponse rotate(UUID keyUid, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        if (key.getStatus() != KeyStatus.ACTIVE && key.getStatus() != KeyStatus.DISTRIBUTED) {
            throw conflict("ACTIVE 또는 DISTRIBUTED 키만 갱신할 수 있습니다.", "KEY_ROTATION_NOT_ALLOWED");
        }

        int previousVersion = key.getCurrentVersion();
        KeyMaterial previousMaterial = verifiedCurrentMaterial(key);
        previousMaterial.retire();

        byte[] rawKey = cryptoUtil.generateAes256Key();
        try {
            CryptoUtil.Base64Payload wrapped = cryptoUtil.wrapKey(rawKey);
            KeyStatus previousStatus = key.getStatus();
            int newVersion = key.nextVersion();
            key.changeStatus(KeyStatus.ACTIVE);
            KeyMaterial newMaterial = new KeyMaterial(key, newVersion, wrapped.ciphertext(), wrapped.iv());
            signIntegrity(key, newMaterial);
            materialRepository.save(newMaterial);
            historyRepository.save(new KeyStatusHistory(
                    key,
                    previousStatus,
                    KeyStatus.ACTIVE,
                    "v" + previousVersion + " 마감 및 v" + newVersion + " 갱신",
                    actor
            ));
            return new KeyRotationResponse(key.getKeyUid(), previousVersion, newVersion, KeyResponse.from(key, true));
        } finally {
            Arrays.fill(rawKey, (byte) 0);
        }
    }

    @Transactional
    public KeyDistributionResponse distribute(UUID keyUid, KeyDistributionRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        if (key.getStatus() != KeyStatus.ACTIVE) {
            throw conflict("ACTIVE 키만 배포할 수 있습니다.", "KEY_DISTRIBUTION_NOT_ALLOWED");
        }

        KeyMaterial material = verifiedCurrentMaterial(key);
        KeyStatus from = key.getStatus();
        material.markDistributed();
        key.changeStatus(KeyStatus.DISTRIBUTED);
        signIntegrity(key, material);
        historyRepository.save(new KeyStatusHistory(
                key,
                from,
                KeyStatus.DISTRIBUTED,
                request.reason().trim() + " (대상: " + request.target().trim() + ")",
                actor
        ));

        return new KeyDistributionResponse(
                key.getKeyUid(),
                material.getKeyVersion(),
                request.target().trim(),
                material.getWrappedKey(),
                material.getWrappingIv(),
                material.getWrappingAlgorithm(),
                "BASE64",
                material.getDistributedAt() == null ? Instant.now() : material.getDistributedAt()
        );
    }

    @Transactional
    public KeyEncryptResponse encrypt(UUID keyUid, KeyEncryptRequest request, String actor) {
        CryptoKey key = activeKeyForUse(keyUid);
        byte[] rawKey = unwrapCurrentKey(key);
        try {
            CryptoUtil.Base64Payload encrypted = cryptoUtil.encryptWithKey(
                    request.plaintext().getBytes(StandardCharsets.UTF_8), rawKey
            );
            usageLogRepository.save(new KeyUsageLog(key, "ENCRYPT", true, null, actor));
            return new KeyEncryptResponse(encrypted.ciphertext(), encrypted.iv(), "BASE64");
        } finally {
            Arrays.fill(rawKey, (byte) 0);
        }
    }

    @Transactional
    public KeyDecryptResponse decrypt(UUID keyUid, KeyDecryptRequest request, String actor) {
        CryptoKey key = activeKeyForUse(keyUid);
        byte[] rawKey = unwrapCurrentKey(key);
        byte[] plaintext = null;
        try {
            plaintext = cryptoUtil.decryptWithKey(
                    new CryptoUtil.Base64Payload(request.ciphertext(), request.iv()), rawKey
            );
            usageLogRepository.save(new KeyUsageLog(key, "DECRYPT", true, null, actor));
            return new KeyDecryptResponse(new String(plaintext, StandardCharsets.UTF_8));
        } finally {
            Arrays.fill(rawKey, (byte) 0);
            if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
        }
    }

    private CryptoKey activeKeyForUse(UUID keyUid) {
        CryptoKey key = findKeyForUpdate(keyUid);
        if (key.getStatus() != KeyStatus.ACTIVE) {
            throw conflict("ACTIVE 상태의 키만 암복호화에 사용할 수 있습니다.", "KEY_NOT_ACTIVE");
        }
        return key;
    }

    private byte[] unwrapCurrentKey(CryptoKey key) {
        KeyMaterial material = verifiedCurrentMaterial(key);
        return cryptoUtil.unwrapKey(new CryptoUtil.Base64Payload(material.getWrappedKey(), material.getWrappingIv()));
    }

    private KeyMaterial currentMaterial(CryptoKey key) {
        return materialRepository.findByCryptoKeyAndKeyVersion(key, key.getCurrentVersion())
                .orElseThrow(() -> new KeyOperationException(
                        HttpStatus.CONFLICT, "현재 키 버전의 키 재료가 없습니다.", "KEY_MATERIAL_MISSING"
                ));
    }

    private KeyMaterial verifiedCurrentMaterial(CryptoKey key) {
        KeyMaterial material = currentMaterial(key);
        if (!verifyIntegrity(key, material)) {
            throw conflict("키 무결성 검증에 실패했습니다.", "KEY_INTEGRITY_VIOLATION");
        }
        return material;
    }

    private KeyResponse responseWithIntegrity(CryptoKey key) {
        KeyMaterial material = currentMaterial(key);
        return KeyResponse.from(key, verifyIntegrity(key, material));
    }

    private void signIntegrity(CryptoKey key, KeyMaterial material) {
        key.updateIntegrityHash(integrityService.sign(integrityValues(key, material)));
    }

    private boolean verifyIntegrity(CryptoKey key, KeyMaterial material) {
        return integrityService.verify(key.getIntegrityHash(), integrityValues(key, material));
    }

    private String[] integrityValues(CryptoKey key, KeyMaterial material) {
        return new String[] {
                key.getKeyUid().toString(), key.getKeyName(), key.getAlgorithm(), Integer.toString(key.getKeySize()),
                key.getPurpose(), key.getStatus().name(), Integer.toString(key.getCurrentVersion()),
                key.getExpireAt() == null ? null : key.getExpireAt().toString(),
                Integer.toString(material.getKeyVersion()), material.getWrappedKey(), material.getWrappingIv(),
                material.getWrappingAlgorithm(), material.getMaterialStatus()
        };
    }

    private CryptoKey findKey(UUID keyUid) {
        return keyRepository.findByKeyUid(keyUid)
                .orElseThrow(() -> notFound(keyUid));
    }

    private CryptoKey findKeyForUpdate(UUID keyUid) {
        return keyRepository.findForUpdateByKeyUid(keyUid)
                .orElseThrow(() -> notFound(keyUid));
    }

    private KeyOperationException notFound(UUID keyUid) {
        return new KeyOperationException(HttpStatus.NOT_FOUND, "키를 찾을 수 없습니다: " + keyUid, "KEY_NOT_FOUND");
    }

    private KeyOperationException conflict(String message, String code) {
        return new KeyOperationException(HttpStatus.CONFLICT, message, code);
    }

    private void validateManagedKeyPolicy(String algorithm, int keySize) {
        if (!"AES".equalsIgnoreCase(algorithm) || keySize != 256) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "현재 관리 키는 AES-256만 지원합니다.",
                    "UNSUPPORTED_KEY_ALGORITHM"
            );
        }
    }

    private static Map<KeyStatus, Set<KeyStatus>> createTransitions() {
        Map<KeyStatus, Set<KeyStatus>> transitions = new EnumMap<>(KeyStatus.class);
        transitions.put(KeyStatus.CREATED, Set.of(KeyStatus.ACTIVE));
        transitions.put(KeyStatus.ACTIVE, Set.of(
                KeyStatus.EXPIRED, KeyStatus.INACTIVE, KeyStatus.DISTRIBUTED,
                KeyStatus.COMPROMISED, KeyStatus.DEACTIVATED
        ));
        transitions.put(KeyStatus.EXPIRED, Set.of(KeyStatus.INACTIVE, KeyStatus.ACTIVE));
        transitions.put(KeyStatus.INACTIVE, Set.of(KeyStatus.DESTROYED));
        transitions.put(KeyStatus.DISTRIBUTED, Set.of(KeyStatus.DESTROYED));
        transitions.put(KeyStatus.COMPROMISED, Set.of(KeyStatus.DESTROYED));
        transitions.put(KeyStatus.DEACTIVATED, Set.of(KeyStatus.ACTIVE, KeyStatus.DESTROYED));
        transitions.put(KeyStatus.DESTROYED, Set.of());
        return Map.copyOf(transitions);
    }
}
