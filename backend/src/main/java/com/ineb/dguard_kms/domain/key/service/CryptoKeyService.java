package com.ineb.dguard_kms.domain.key.service;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
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
import com.ineb.dguard_kms.domain.key.dto.KeyIntegrityItemResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyIntegrityReportResponse;
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
    public static final String PENDING_MATERIAL_INTEGRITY_HASH = "PENDING_V8_MATERIAL_SIGN";

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
        ManagedKeyPolicy policy = validateManagedKeyPolicy(request.algorithm(), request.mode(), request.keySize());
        validateRotationDays(request.autoRotationDays());
        if (keyRepository.existsByKeyName(request.keyName().trim())) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        }

        byte[] rawKey = null;
        try {
            String publicKey = null;
            if ("AES".equals(policy.algorithm())) {
                rawKey = cryptoUtil.generateAesKey(policy.keySize());
            } else {
                KeyPair keyPair = cryptoUtil.generateRsaKeyPair(policy.keySize());
                rawKey = keyPair.getPrivate().getEncoded();
                publicKey = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
            }
            // 원시 키는 DB에 저장하지 않고 마스터키로 래핑한 값만 영속화한다.
            CryptoUtil.Base64Payload wrapped = cryptoUtil.wrapKey(rawKey);
            CryptoKey key = new CryptoKey(
                    request.keyName().trim(), policy.algorithm(), policy.mode(), policy.keySize(),
                    request.purpose().trim(), request.expireAt(), request.autoRotationDays(), publicKey, actor
            );
            KeyMaterial material = new KeyMaterial(
                    key, 1, cryptoUtil.decodeBase64(wrapped.ciphertext()), cryptoUtil.decodeBase64(wrapped.iv()), actor
            );
            signIntegrity(key);
            signMaterial(key, material);
            keyRepository.save(key);
            materialRepository.save(material);
            historyRepository.save(new KeyStatusHistory(
                    key, KeyStatus.CREATED, KeyStatus.CREATED, "CREATE", "키 최초 생성", actor
            ));
            auditLogService.append(actor, "KEY_CREATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                    key.getKeyName() + " v1 키 생성");
            return KeyResponse.from(key, true);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("이미 사용 중인 키 이름입니다.", "KEY_NAME_DUPLICATED");
        } finally {
            // 원시 키는 필요한 작업이 끝나는 즉시 메모리에서 지운다.
            if (rawKey != null) Arrays.fill(rawKey, (byte) 0);
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

    @Transactional(readOnly = true)
    public KeyIntegrityReportResponse verifyAllIntegrity() {
        List<KeyIntegrityItemResponse> results = keyRepository.findAll(Sort.by("keyUid")).stream()
                .map(this::verifyKeyAndAllVersions)
                .toList();
        long valid = results.stream().filter(KeyIntegrityItemResponse::valid).count();
        return new KeyIntegrityReportResponse(
                Instant.now(), results.size(), valid, results.size() - valid, results
        );
    }

    private KeyIntegrityItemResponse verifyKeyAndAllVersions(CryptoKey key) {
        List<String> violations = new java.util.ArrayList<>();
        List<Integer> invalidVersions = new java.util.ArrayList<>();
        if (!integrityService.verify(key.getIntegrityHash(), integrityValues(key))) {
            violations.add("KEY_METADATA_HMAC_MISMATCH");
        }
        List<KeyMaterial> materials = materialRepository.findAllByCryptoKeyOrderByKeyVersionDesc(key);
        if (materials.stream().noneMatch(material -> material.getKeyVersion() == key.getCurrentVersion())) {
            violations.add("CURRENT_KEY_MATERIAL_MISSING");
        }
        for (KeyMaterial material : materials) {
            if (!integrityService.verify(material.getIntegrityHash(), materialIntegrityValues(key, material))) {
                invalidVersions.add(material.getKeyVersion());
            }
            if (key.getStatus() == KeyStatus.DESTROYED && !material.isDestroyed()) {
                violations.add("DESTROYED_KEY_VALUE_NOT_NULL:v" + material.getKeyVersion());
            }
            if (key.getStatus() != KeyStatus.DESTROYED && material.isDestroyed()) {
                violations.add("LIVE_KEY_VALUE_MISSING:v" + material.getKeyVersion());
            }
        }
        if (!invalidVersions.isEmpty()) violations.add("KEY_MATERIAL_HMAC_MISMATCH");
        if (key.getStatus() == KeyStatus.DESTROYED && key.getPublicKey() != null) {
            violations.add("DESTROYED_PUBLIC_KEY_NOT_NULL");
        }
        return new KeyIntegrityItemResponse(
                key.getKeyUid(), key.getKeyName(), key.getStatus(), violations.isEmpty(),
                List.copyOf(invalidVersions), List.copyOf(violations)
        );
    }

    @Transactional
    public int resignSchemaMigratedKeys() {
        List<CryptoKey> pendingKeys = keyRepository.findAllByIntegrityHash(PENDING_SCHEMA_INTEGRITY_HASH);
        pendingKeys.forEach(this::signIntegrity);
        return pendingKeys.size();
    }

    @Transactional
    public int resignSchemaMigratedMaterials() {
        List<KeyMaterial> pendingMaterials = materialRepository.findAllByIntegrityHash(PENDING_MATERIAL_INTEGRITY_HASH);
        pendingMaterials.forEach(material -> signMaterial(material.getCryptoKey(), material));
        return pendingMaterials.size();
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
                signMaterial(material.getCryptoKey(), material);
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
                key, key.getStatus(), key.getStatus(), "METADATA_UPDATE", "키 메타정보 수정", actor
        ));
        auditLogService.append(actor, "KEY_UPDATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                key.getKeyName() + " 메타정보 수정");
        return KeyResponse.from(key, true);
    }

    @Transactional
    public void delete(UUID keyUid, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        String keyName = key.getKeyName();
        KeyStatus from = key.getStatus();
        if (from == KeyStatus.DESTROYED) return;
        for (KeyMaterial version : materialRepository.findAllByCryptoKeyOrderByKeyVersionDesc(key)) {
            version.destroy();
            signMaterial(key, version);
        }
        key.destroyPublicKey();
        key.changeStatus(KeyStatus.DESTROYED);
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(
                key, from, KeyStatus.DESTROYED, "DESTROY", "관리자 즉시 폐기 및 원시 키 제로화", actor
        ));
        auditLogService.append(actor, "KEY_DELETE", "CRYPTO_KEY", keyUid.toString(),
                keyName + " 키 재료 제로화 및 폐기");
    }

    @Transactional
    public KeyResponse updateRotationPolicy(UUID keyUid, KeyRotationPolicyRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        KeyMaterial material = verifiedCurrentMaterial(key);
        Integer days = request.days();
        validateRotationDays(days);
        key.updateAutoRotationDays(days);
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(
                key, key.getStatus(), key.getStatus(),
                "ROTATION_POLICY_UPDATE",
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
        if (to == KeyStatus.DISTRIBUTED || to == KeyStatus.REACTIVATED || to == KeyStatus.EXPIRED || to == KeyStatus.INACTIVE) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "화면에서 지원하지 않는 레거시 상태입니다.",
                    "LEGACY_KEY_STATUS_NOT_ALLOWED"
            );
        }
        if (!from.canTransitionTo(to)) {
            throw conflict("허용되지 않은 키 상태 전이입니다: " + from + " -> " + to, "INVALID_KEY_STATUS_TRANSITION");
        }
        key.changeStatus(to);
        if (to == KeyStatus.DESTROYED) {
            for (KeyMaterial version : materialRepository.findAllByCryptoKeyOrderByKeyVersionDesc(key)) {
                version.destroy();
                signMaterial(key, version);
            }
            key.destroyPublicKey();
        }
        signIntegrity(key);
        historyRepository.save(new KeyStatusHistory(key, from, to, "LIFECYCLE", request.reason().trim(), actor));
        auditLogService.append(actor, "KEY_STATUS_CHANGE", "CRYPTO_KEY", key.getKeyUid().toString(),
                from + " → " + to + ": " + request.reason().trim());
        return KeyResponse.from(key, true);
    }

    @Transactional
    public KeyRotationResponse rotate(UUID keyUid, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        return rotateLocked(key, actor);
    }

    @Transactional(readOnly = true)
    public List<UUID> autoRotationCandidates() {
        Instant now = Instant.now();
        return keyRepository.findAll().stream()
                .filter(key -> key.getAutoRotationDays() != null && key.getStatus().canRotate())
                .filter(key -> materialRepository.findByCryptoKeyAndKeyVersion(key, key.getCurrentVersion())
                        .map(material -> !material.getCreatedAt()
                                .plusSeconds(key.getAutoRotationDays() * 86_400L).isAfter(now))
                        .orElse(false))
                .map(CryptoKey::getKeyUid)
                .toList();
    }

    @Transactional
    public boolean rotateIfDue(UUID keyUid, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        Integer days = key.getAutoRotationDays();
        if (days == null || !key.getStatus().canRotate()) return false;
        KeyMaterial material = verifiedCurrentMaterial(key);
        if (material.getCreatedAt().plusSeconds(days * 86_400L).isAfter(Instant.now())) return false;
        rotateLocked(key, actor);
        return true;
    }

    private KeyRotationResponse rotateLocked(CryptoKey key, String actor) {
        if (!key.getStatus().canRotate()) {
            throw conflict("활성 또는 비활성 키만 갱신할 수 있습니다.", "KEY_ROTATION_NOT_ALLOWED");
        }

        int previousVersion = key.getCurrentVersion();
        KeyMaterial previousMaterial = verifiedCurrentMaterial(key);

        byte[] rawKey = null;
        byte[] wrappedBytes = null;
        byte[] ivBytes = null;
        try {
            String publicKey = null;
            if ("AES".equals(key.getAlgorithm())) {
                rawKey = cryptoUtil.generateAesKey(key.getKeySize());
            } else {
                KeyPair keyPair = cryptoUtil.generateRsaKeyPair(key.getKeySize());
                rawKey = keyPair.getPrivate().getEncoded();
                publicKey = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
            }
            CryptoUtil.Base64Payload wrapped = cryptoUtil.wrapKey(rawKey);
            int newVersion = key.nextVersion();
            previousMaterial.retire();
            signMaterial(key, previousMaterial);
            wrappedBytes = cryptoUtil.decodeBase64(wrapped.ciphertext());
            ivBytes = cryptoUtil.decodeBase64(wrapped.iv());
            KeyMaterial newMaterial = new KeyMaterial(key, newVersion, wrappedBytes, ivBytes, actor);
            if (publicKey != null) key.updatePublicKey(publicKey);
            signMaterial(key, newMaterial);
            materialRepository.save(newMaterial);
            signIntegrity(key);
            historyRepository.save(new KeyStatusHistory(
                    key, key.getStatus(), key.getStatus(), "KEY_ROTATE",
                    "키 재료 v" + previousVersion + " → v" + newVersion + " 갱신", actor
            ));
            auditLogService.append(actor, "KEY_ROTATE", "CRYPTO_KEY", key.getKeyUid().toString(),
                    "v" + previousVersion + " → v" + newVersion + " 키 갱신");
            return new KeyRotationResponse(key.getKeyUid(), previousVersion, newVersion, KeyResponse.from(key, true));
        } finally {
            if (rawKey != null) Arrays.fill(rawKey, (byte) 0);
            if (wrappedBytes != null) Arrays.fill(wrappedBytes, (byte) 0);
            if (ivBytes != null) Arrays.fill(ivBytes, (byte) 0);
        }
    }

    @Transactional
    public KeyDistributionResponse distribute(UUID keyUid, KeyDistributionRequest request, String actor) {
        CryptoKey key = findKeyForUpdate(keyUid);
        if (!key.getStatus().canEncrypt()) {
            throw conflict("ACTIVE 키만 배포할 수 있습니다.", "KEY_DISTRIBUTION_NOT_ALLOWED");
        }

        KeyMaterial material = verifiedCurrentMaterial(key);
        material.markDistributed();
        signMaterial(key, material);
        historyRepository.save(new KeyStatusHistory(
                key,
                key.getStatus(),
                key.getStatus(),
                "DISTRIBUTE",
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
            requireEncryptAllowed(key);
            int requestedVersion = request.version() == null ? key.getCurrentVersion() : request.version();
            if (requestedVersion != key.getCurrentVersion()) {
                throw new KeyOperationException(
                        HttpStatus.BAD_REQUEST,
                        "과거 키 버전은 복호화 전용입니다.",
                        "KEY_VERSION_ENCRYPT_NOT_ALLOWED"
                );
            }
            String ciphertext;
            String iv;
            if ("RSA".equals(key.getAlgorithm())) {
                verifiedCurrentMaterial(key);
                ciphertext = cryptoUtil.encryptRsa(
                        request.plaintext().getBytes(StandardCharsets.UTF_8), key.getPublicKey()
                );
                iv = null;
            } else {
                rawKey = unwrapKeyVersion(key, requestedVersion);
                CryptoUtil.Base64Payload encrypted = cryptoUtil.encryptAes(
                        request.plaintext().getBytes(StandardCharsets.UTF_8), rawKey, key.getMode()
                );
                ciphertext = encrypted.ciphertext();
                iv = encrypted.iv();
            }
            auditLogService.append(actor, "KEY_TEST", "CRYPTO_KEY", key.getKeyUid().toString(), "암호화 성공");
            usageLogRepository.save(new KeyUsageLog(key, "ENCRYPT", true, null, actor));
            return new KeyEncryptResponse(
                    ciphertext, iv, "BASE64", requestedVersion
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
            requireDecryptAllowed(key);
            rawKey = unwrapKeyVersion(key, request.version());
            if ("RSA".equals(key.getAlgorithm())) {
                plaintext = cryptoUtil.decryptRsa(request.ciphertext(), rawKey);
            } else {
                if (request.iv() == null || request.iv().isBlank()) {
                    throw new IllegalArgumentException("AES 복호화에는 IV가 필요합니다.");
                }
                plaintext = cryptoUtil.decryptAes(
                        new CryptoUtil.Base64Payload(request.ciphertext(), request.iv()), rawKey, key.getMode()
                );
            }
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

    private void requireEncryptAllowed(CryptoKey key) {
        if (!key.getStatus().canEncrypt()) {
            String code = key.getStatus() == KeyStatus.CREATED ? "KEY_NOT_ACTIVE" : "KEY_ENCRYPT_NOT_ALLOWED";
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "현재 키 상태에서는 암호화할 수 없습니다.",
                    code
            );
        }
    }

    private void requireDecryptAllowed(CryptoKey key) {
        if (!key.getStatus().canDecrypt()) {
            String code = key.getStatus() == KeyStatus.CREATED ? "KEY_NOT_ACTIVE" : "KEY_DECRYPT_NOT_ALLOWED";
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "현재 키 상태에서는 복호화할 수 없습니다.",
                    code
            );
        }
    }

    private void recordUsageFailure(CryptoKey key, String operation, String reason, String actor) {
        String safeReason = reason == null || reason.isBlank() ? "요청 처리 실패" : reason;
        usageLogRepository.save(new KeyUsageLog(key, operation, false, safeReason, actor));
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

    private void signMaterial(CryptoKey key, KeyMaterial material) {
        material.updateIntegrityHash(integrityService.sign(materialIntegrityValues(key, material)));
    }

    private boolean verifyIntegrity(CryptoKey key, KeyMaterial material) {
        return integrityService.verify(key.getIntegrityHash(), integrityValues(key))
                && integrityService.verify(material.getIntegrityHash(), materialIntegrityValues(key, material));
    }

    private String[] integrityValues(CryptoKey key) {
        return new String[] {
                key.getKeyUid().toString(), key.getKeyName(), key.getAlgorithm(), key.getMode(),
                Integer.toString(key.getKeySize()),
                key.getPurpose(), key.getStatus().name(), Integer.toString(key.getCurrentVersion()),
                key.getExpireAtInstant() == null ? "" : key.getExpireAtInstant().toString(),
                key.getCreatedBy(), key.getCreatedAt().toString(),
                key.getAutoRotationDays() == null ? "" : key.getAutoRotationDays().toString(),
                key.getPublicKey() == null ? "" : key.getPublicKey()
        };
    }

    private String[] materialIntegrityValues(CryptoKey key, KeyMaterial material) {
        byte[] wrapped = material.getWrappedKey();
        byte[] iv = material.getWrappingIv();
        try {
            return new String[] {
                    key.getKeyUid().toString(), Integer.toString(material.getKeyVersion()),
                    wrapped == null ? "" : Base64.getEncoder().encodeToString(wrapped),
                    iv == null ? "" : Base64.getEncoder().encodeToString(iv),
                    material.getWrappingAlgorithm(), material.getMaterialStatus(), material.getCreatedBy()
            };
        } finally {
            if (wrapped != null) Arrays.fill(wrapped, (byte) 0);
            if (iv != null) Arrays.fill(iv, (byte) 0);
        }
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

    private ManagedKeyPolicy validateManagedKeyPolicy(String requestedAlgorithm, String requestedMode, int keySize) {
        String algorithm = requestedAlgorithm.trim().toUpperCase(Locale.ROOT);
        String mode = requestedMode == null || requestedMode.isBlank()
                ? ("RSA".equals(algorithm) ? "OAEP_SHA256" : "GCM")
                : requestedMode.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        boolean valid = switch (algorithm) {
            case "AES" -> keySize == 256 && "GCM".equals(mode);
            case "RSA" -> keySize == 2048 && "OAEP_SHA256".equals(mode);
            default -> false;
        };
        if (!valid) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "지원 정책은 AES-256-GCM 또는 RSA-2048-SHA256입니다.",
                    "UNSUPPORTED_KEY_ALGORITHM"
            );
        }
        return new ManagedKeyPolicy(algorithm, mode, keySize);
    }

    private void validateRotationDays(Integer days) {
        if (days != null && (days < 1 || days > 3650)) {
            throw new KeyOperationException(
                    HttpStatus.BAD_REQUEST,
                    "자동 갱신 주기는 1~3650일 범위의 일 단위 값이어야 합니다.",
                    "INVALID_ROTATION_POLICY"
            );
        }
    }

    private record ManagedKeyPolicy(String algorithm, String mode, int keySize) { }

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
            if (status == KeyStatus.ACTIVE) {
                predicates.add(root.get("status").in(KeyStatus.ACTIVE, KeyStatus.REACTIVATED, KeyStatus.DISTRIBUTED));
            } else if (status == KeyStatus.DEACTIVATED) {
                predicates.add(root.get("status").in(KeyStatus.DEACTIVATED, KeyStatus.EXPIRED, KeyStatus.INACTIVE));
            } else if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
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
