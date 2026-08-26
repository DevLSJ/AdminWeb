package com.ineb.dguard_kms.domain.key.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.crypto.CryptoOperationException;
import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.crypto.IntegrityService;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.domain.key.dto.KeyCreateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDistributionResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyHistoryResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyRotationPolicyRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyRotationResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyStatusChangeRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyUpdateRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyUsageSummaryResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyVersionResponse;
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

    public static final String PENDING_SCHEMA_INTEGRITY_HASH = "PENDING_V6_SCHEMA_REALIGN";

    private final CryptoKeyRepository keyRepository;
    private final KeyMaterialRepository materialRepository;
    private final KeyStatusHistoryRepository historyRepository;
    private final KeyUsageLogRepository usageLogRepository;
    private final CryptoUtil cryptoUtil;
    private final IntegrityService integrityService;
    private final AuditLogService auditLogService;

    public CryptoKeyService(
            CryptoKeyRepository keyRepository,
            KeyMaterialRepository materialRepository,
            KeyStatusHistoryRepository historyRepository,
            KeyUsageLogRepository usageLogRepository,
            CryptoUtil cryptoUtil,
            IntegrityService integrityService,
            AuditLogService auditLogService
    ) {
        this.keyRepository = keyRepository;
        this.materialRepository = materialRepository;
        this.historyRepository = historyRepository;
        this.usageLogRepository = usageLogRepository;
        this.cryptoUtil = cryptoUtil;
        this.integrityService = integrityService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public KeyResponse create(KeyCreateRequest request, String actor) {
        validateManagedKeyPolicy(request.algorithm(), request.keySize());
        if (keyRepository.existsByKeyName(request.keyName().trim())) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        }

        byte[] rawKey = cryptoUtil.generateAes256Key();
        try {
            // 원시 키는 DB에 저장하지 않고 마스터키로 래핑한 값만 영속화한다.
            CryptoUtil.Base64Payload wrapped = cryptoUtil.wrapKey(rawKey);
            CryptoKey key = new CryptoKey(
                    request.keyName().trim(), "AES", 256, request.purpose().trim(), request.expireAt(), actor
            );
            KeyMaterial material = new KeyMaterial(
                    key, 1, cryptoUtil.decodeBase64(wrapped.ciphertext()), cryptoUtil.decodeBase64(wrapped.iv()), actor
            );
            signIntegrity(key);
            keyRepository.save(key);
            materialRepository.save(material);
            historyRepository.save(new KeyStatusHistory(
                    key, KeyStatus.CREATED, KeyStatus.CREATED, "키 최초 생성", actor
            ));
            auditLogService.append(actor, "KEY_CREATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                    key.getKeyName() + " v1 키 생성");
            return KeyResponse.from(key, true);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        } finally {
            // 원시 키는 필요한 작업이 끝나는 즉시 메모리에서 지운다.
            Arrays.fill(rawKey, (byte) 0);
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<KeyResponse> findAll(
            String keyword,
            String algorithm,
            KeyStatus status,
            String purpose,
            int page,
            int size,
            String sort
    ) {
        Specification<CryptoKey> filters = keyFilters(keyword, algorithm, status, purpose);
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                keySort(sort)
        );
        Page<KeyResponse> result = keyRepository.findAll(filters, pageable).map(this::responseWithIntegrity);
        return PageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public KeyResponse find(UUID keyUid) {
        CryptoKey key = findKey(keyUid);
        verifiedCurrentMaterial(key);
        return KeyResponse.from(key, true);
    }

    @Transactional(readOnly = true)
    public List<KeyHistoryResponse> history(UUID keyUid) {
        CryptoKey key = findKey(keyUid);
        return historyRepository.findAllByCryptoKeyOrderByChangedAtDesc(key).stream()
                .map(KeyHistoryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public KeyUsageSummaryResponse usage(UUID keyUid) {
        CryptoKey key = findKey(keyUid);
        return new KeyUsageSummaryResponse(
                usageLogRepository.countByCryptoKey(key),
                usageLogRepository.countByCryptoKeyAndResult(key, "SUCCESS"),
                usageLogRepository.countByCryptoKeyAndResult(key, "FAILURE"),
                usageLogRepository.countByCryptoKeyAndOperation(key, "ENCRYPT"),
                usageLogRepository.countByCryptoKeyAndOperation(key, "DECRYPT")
        );
    }

    @Transactional(readOnly = true)
    public List<KeyVersionResponse> versions(UUID keyUid) {
        CryptoKey key = findKey(keyUid);
        return materialRepository.findAllByCryptoKeyOrderByKeyVersionDesc(key).stream()
                .map(KeyVersionResponse::from)
                .toList();
    }

    @Transactional
    public int resignSchemaMigratedKeys() {
        List<CryptoKey> pendingKeys = keyRepository.findAllByIntegrityHash(PENDING_SCHEMA_INTEGRITY_HASH);
        pendingKeys.forEach(this::signIntegrity);
        return pendingKeys.size();
    }

    @Transactional
    public int rewrapLegacyKeyMaterials() {
        List<KeyMaterial> legacyMaterials = materialRepository.findAllWithLegacyWrappingIv();
        for (KeyMaterial material : legacyMaterials) {
            byte[] rawKey = null;
            byte[] wrappedBytes = null;
            byte[] ivBytes = null;
            try {
                rawKey = cryptoUtil.unwrapKey(new CryptoUtil.Base64Payload(
                        cryptoUtil.encodeBase64(material.getWrappedKey()),
                        cryptoUtil.encodeBase64(material.getWrappingIv())
                ));
                CryptoUtil.Base64Payload rewrapped = cryptoUtil.wrapKey(rawKey);
                wrappedBytes = cryptoUtil.decodeBase64(rewrapped.ciphertext());
                ivBytes = cryptoUtil.decodeBase64(rewrapped.iv());
                material.rewrap(wrappedBytes, ivBytes);
            } finally {
                if (rawKey != null) Arrays.fill(rawKey, (byte) 0);
                if (wrappedBytes != null) Arrays.fill(wrappedBytes, (byte) 0);
                if (ivBytes != null) Arrays.fill(ivBytes, (byte) 0);
            }
        }
        return legacyMaterials.size();
    }

    @Transactional
    public KeyResponse update(UUID keyUid, KeyUpdateRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        KeyMaterial material = verifiedCurrentMaterial(key);
        String keyName = request.keyName().trim();
        if (!keyName.equals(key.getKeyName()) && keyRepository.existsByKeyName(keyName)) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        }
        key.updateMetadata(keyName, request.purpose().trim(), request.expireAt());
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(
                key, key.getStatus(), key.getStatus(), "키 메타정보 수정", actor
        ));
        auditLogService.append(actor, "KEY_UPDATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                key.getKeyName() + " 메타정보 수정");
        return KeyResponse.from(key, true);
    }

    @Transactional
    public KeyResponse updateRotationPolicy(UUID keyUid, KeyRotationPolicyRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        KeyMaterial material = verifiedCurrentMaterial(key);
        Integer days = request.days();
        if (days != null && !Set.of(30, 60, 90).contains(days)) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST, "자동 갱신 주기는 30, 60, 90일만 지원합니다.", "INVALID_ROTATION_POLICY"
            );
        }
        key.updateAutoRotationDays(days);
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(
                key, key.getStatus(), key.getStatus(),
                days == null ? "자동 갱신 미사용" : "자동 갱신 주기 " + days + "일 설정", actor
        ));
        auditLogService.append(actor, "KEY_AUTO_ROTATION_UPDATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                days == null ? "자동 갱신 미사용" : "자동 갱신 주기 " + days + "일");
        return KeyResponse.from(key, true);
    }

    @Transactional
    public KeyResponse changeStatus(UUID keyUid, KeyStatusChangeRequest request, String actor) {
        // 잠금 조회로 동시에 들어온 상태 변경·갱신 요청이 서로 덮어쓰는 것을 막는다.
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
        if (!from.canTransitionTo(to)) {
            throw conflict("허용되지 않은 키 상태 전이입니다: " + from + " -> " + to, "INVALID_KEY_STATUS_TRANSITION");
        }
        key.changeStatus(to);
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(key, from, to, request.reason().trim(), actor));
        auditLogService.append(actor, "KEY_STATUS_CHANGE", "CRYPTO_KEY", key.getKeyUid().toString(),
                from + " → " + to + ": " + request.reason().trim());
        return KeyResponse.from(key, true);
    }

    @Transactional
    public KeyRotationResponse rotate(UUID keyUid, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        if (key.getStatus() != KeyStatus.ACTIVE) {
            throw conflict("ACTIVE 키만 갱신할 수 있습니다.", "KEY_ROTATION_NOT_ALLOWED");
        }

        int previousVersion = key.getCurrentVersion();
        KeyMaterial previousMaterial = verifiedCurrentMaterial(key);

        byte[] rawKey = cryptoUtil.generateAes256Key();
        byte[] wrappedBytes = null;
        byte[] ivBytes = null;
        try {
            CryptoUtil.Base64Payload wrapped = cryptoUtil.wrapKey(rawKey);
            int newVersion = key.nextVersion();
            previousMaterial.retire();
            wrappedBytes = cryptoUtil.decodeBase64(wrapped.ciphertext());
            ivBytes = cryptoUtil.decodeBase64(wrapped.iv());
            materialRepository.save(new KeyMaterial(key, newVersion, wrappedBytes, ivBytes, actor));
            signIntegrity(key);
            auditLogService.append(actor, "KEY_ROTATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                    "v" + previousVersion + " → v" + newVersion + " 키 갱신");
            return new KeyRotationResponse(key.getKeyUid(), previousVersion, newVersion, KeyResponse.from(key, true));
        } finally {
            Arrays.fill(rawKey, (byte) 0);
            if (wrappedBytes != null) Arrays.fill(wrappedBytes, (byte) 0);
            if (ivBytes != null) Arrays.fill(ivBytes, (byte) 0);
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
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(
                key,
                from,
                KeyStatus.DISTRIBUTED,
                request.reason().trim() + " (대상: " + request.target().trim() + ")",
                actor
        ));
        auditLogService.append(actor, "KEY_DEPLOY", "CRYPTO_KEY", key.getKeyUid().toString(),
                "v" + material.getKeyVersion() + " 키 배포: " + request.target().trim());

        return new KeyDistributionResponse(
                key.getKeyUid(),
                material.getKeyVersion(),
                request.target().trim(),
                key.getStatus(),
                material.getDistributedAt() == null ? Instant.now() : material.getDistributedAt()
        );
    }

    @Transactional(noRollbackFor = KeyOperationException.class)
    public KeyEncryptResponse encrypt(UUID keyUid, KeyEncryptRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        byte[] rawKey = null;
        try {
            requireActive(key);
            rawKey = unwrapCurrentKey(key);
            CryptoUtil.Base64Payload encrypted = cryptoUtil.encryptWithKey(
                    request.plaintext().getBytes(StandardCharsets.UTF_8), rawKey
            );
            auditLogService.append(actor, "KEY_TEST", "CRYPTO_KEY", key.getKeyUid().toString(), "암호화 성공");
            usageLogRepository.save(new KeyUsageLog(key, "ENCRYPT", true, null, actor));
            return new KeyEncryptResponse(
                    encrypted.ciphertext(), encrypted.iv(), "BASE64", key.getCurrentVersion()
            );
        } catch (KeyOperationException exception) {
            recordUsageFailure(key, "ENCRYPT", exception.getMessage(), actor);
            throw exception;
        } catch (CryptoOperationException | IllegalArgumentException exception) {
            recordUsageFailure(key, "ENCRYPT", exception.getMessage(), actor);
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST, "암호화 요청을 처리할 수 없습니다.", "KEY_ENCRYPTION_FAILED"
            );
        } finally {
            if (rawKey != null) Arrays.fill(rawKey, (byte) 0);
        }
    }

    @Transactional(noRollbackFor = KeyOperationException.class)
    public KeyDecryptResponse decrypt(UUID keyUid, KeyDecryptRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        byte[] rawKey = null;
        byte[] plaintext = null;
        try {
            requireActive(key);
            rawKey = unwrapKeyVersion(key, request.version());
            plaintext = cryptoUtil.decryptWithKey(
                    new CryptoUtil.Base64Payload(request.ciphertext(), request.iv()), rawKey
            );
            auditLogService.append(actor, "KEY_TEST", "CRYPTO_KEY", key.getKeyUid().toString(), "복호화 성공");
            usageLogRepository.save(new KeyUsageLog(key, "DECRYPT", true, null, actor));
            return new KeyDecryptResponse(new String(plaintext, StandardCharsets.UTF_8));
        } catch (KeyOperationException exception) {
            recordUsageFailure(key, "DECRYPT", exception.getMessage(), actor);
            throw exception;
        } catch (CryptoOperationException | IllegalArgumentException exception) {
            recordUsageFailure(key, "DECRYPT", exception.getMessage(), actor);
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST, "복호화 요청을 처리할 수 없습니다.", "KEY_DECRYPTION_FAILED"
            );
        } finally {
            if (rawKey != null) Arrays.fill(rawKey, (byte) 0);
            if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
        }
    }

    private void requireActive(CryptoKey key) {
        if (key.getStatus() != KeyStatus.ACTIVE) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "ACTIVE 상태의 키만 암복호화에 사용할 수 있습니다.",
                    "KEY_NOT_ACTIVE"
            );
        }
    }

    private void recordUsageFailure(CryptoKey key, String operation, String reason, String actor) {
        String safeReason = reason == null || reason.isBlank() ? "요청 처리 실패" : reason;
        usageLogRepository.save(new KeyUsageLog(key, operation, false, safeReason, actor));
    }

    private byte[] unwrapCurrentKey(CryptoKey key) {
        return unwrapKeyVersion(key, key.getCurrentVersion());
    }

    private byte[] unwrapKeyVersion(CryptoKey key, Integer requestedVersion) {
        int version = requestedVersion == null ? key.getCurrentVersion() : requestedVersion;
        KeyMaterial material = materialRepository.findByCryptoKeyAndKeyVersion(key, version)
                .orElseThrow(() -> new KeyOperationException(
                        HttpStatus.NOT_FOUND,
                        "요청한 키 버전을 찾을 수 없습니다: v" + version,
                        "KEY_VERSION_NOT_FOUND"
                ));
        if (!verifyIntegrity(key, material)) {
            throw conflict("키 무결성 검증에 실패했습니다.", "KEY_INTEGRITY_VIOLATION");
        }
        return cryptoUtil.unwrapKey(new CryptoUtil.Base64Payload(
                cryptoUtil.encodeBase64(material.getWrappedKey()),
                cryptoUtil.encodeBase64(material.getWrappingIv())
        ));
    }

    private KeyMaterial currentMaterial(CryptoKey key) {
        return materialRepository.findByCryptoKeyAndKeyVersion(key, key.getCurrentVersion())
                .orElseThrow(() -> new KeyOperationException(
                        HttpStatus.CONFLICT, "현재 키 버전의 키 재료가 없습니다.", "KEY_MATERIAL_MISSING"
                ));
    }

    private KeyMaterial verifiedCurrentMaterial(CryptoKey key) {
        KeyMaterial material = currentMaterial(key);
        // 키 메타데이터나 래핑 값이 변조된 경우 실제 암호 연산 전에 차단한다.
        if (!verifyIntegrity(key, material)) {
            throw conflict("키 무결성 검증에 실패했습니다.", "KEY_INTEGRITY_VIOLATION");
        }
        return material;
    }

    private KeyResponse responseWithIntegrity(CryptoKey key) {
        KeyMaterial material = currentMaterial(key);
        return KeyResponse.from(key, verifyIntegrity(key, material));
    }

    private void signIntegrity(CryptoKey key) {
        key.updateIntegrityHash(integrityService.sign(integrityValues(key)));
    }

    private boolean verifyIntegrity(CryptoKey key, KeyMaterial material) {
        return integrityService.verify(key.getIntegrityHash(), integrityValues(key));
    }

    private String[] integrityValues(CryptoKey key) {
        return new String[] {
                key.getKeyUid().toString(), key.getKeyName(), key.getAlgorithm(), Integer.toString(key.getKeySize()),
                key.getPurpose(), key.getStatus().name(), Integer.toString(key.getCurrentVersion()),
                key.getExpireAtInstant() == null ? "" : key.getExpireAtInstant().toString(),
                key.getCreatedBy(), key.getCreatedAt().toString()
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

    private Specification<CryptoKey> keyFilters(
            String keyword,
            String algorithm,
            KeyStatus status,
            String purpose
    ) {
        return (root, query, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                String normalized = keyword.trim().toLowerCase(java.util.Locale.ROOT);
                var nameMatch = builder.like(builder.lower(root.get("keyName")), "%" + normalized + "%");
                try {
                    predicates.add(builder.or(nameMatch, builder.equal(root.get("keyUid"), UUID.fromString(normalized))));
                } catch (IllegalArgumentException ignored) {
                    predicates.add(nameMatch);
                }
            }
            if (algorithm != null && !algorithm.isBlank()) {
                predicates.add(builder.equal(builder.upper(root.get("algorithm")), algorithm.trim().toUpperCase(java.util.Locale.ROOT)));
            }
            if (status != null) predicates.add(builder.equal(root.get("status"), status));
            if (purpose != null && !purpose.isBlank()) {
                predicates.add(builder.equal(builder.upper(root.get("purpose")), purpose.trim().toUpperCase(java.util.Locale.ROOT)));
            }
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private Sort keySort(String requestedSort) {
        String[] parts = requestedSort == null ? new String[0] : requestedSort.split(",", 2);
        String property = switch (parts.length == 0 ? "" : parts[0]) {
            case "keyName" -> "keyName";
            case "expireAt" -> "expireAt";
            case "status" -> "status";
            default -> "createdAt";
        };
        Sort.Direction direction = parts.length > 1 && "asc".equalsIgnoreCase(parts[1])
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        return Sort.by(direction, property);
    }
}
