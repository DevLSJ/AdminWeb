package com.ineb.dguard_kms.domain.user.service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.crypto.IntegrityService;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.domain.user.dto.UserCreateRequest;
import com.ineb.dguard_kms.domain.user.dto.UserPasswordResetRequest;
import com.ineb.dguard_kms.domain.user.dto.UserPlainResponse;
import com.ineb.dguard_kms.domain.user.dto.UserResponse;
import com.ineb.dguard_kms.domain.user.dto.UserUpdateRequest;
import com.ineb.dguard_kms.domain.user.entity.AppUser;
import com.ineb.dguard_kms.domain.user.repository.AppUserRepository;
import com.ineb.dguard_kms.security.PasswordService;

@Service
public class AppUserService {

    private static final String USER_INTEGRITY_DOMAIN = "APP_USER_ROW_V1";
    private static final String NAME_LOOKUP_DOMAIN = "APP_USER_NAME_LOOKUP_V1";
    private static final String PHONE_LOOKUP_DOMAIN = "APP_USER_PHONE_LOOKUP_V1";
    private static final String EMAIL_LOOKUP_DOMAIN = "APP_USER_EMAIL_LOOKUP_V1";

    private final AppUserRepository repository;
    private final CryptoUtil cryptoUtil;
    private final IntegrityService integrityService;
    private final PasswordService passwordService;
    private final AuditLogService auditLogService;

    public AppUserService(
            AppUserRepository repository,
            CryptoUtil cryptoUtil,
            IntegrityService integrityService,
            PasswordService passwordService,
            AuditLogService auditLogService
    ) {
        this.repository = repository;
        this.cryptoUtil = cryptoUtil;
        this.integrityService = integrityService;
        this.passwordService = passwordService;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> search(
            String name,
            String phone,
            String status,
            int page,
            int size
    ) {
        String nameHash = isBlank(name) ? null : lookupHash(NAME_LOOKUP_DOMAIN, normalizeName(name));
        String phoneHash = isBlank(phone) ? null : lookupHash(PHONE_LOOKUP_DOMAIN, normalizePhone(phone));
        String normalizedStatus = normalizeStatus(status, true);
        Specification<AppUser> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (nameHash != null) predicates.add(builder.equal(root.get("nameSearchHash"), nameHash));
            if (phoneHash != null) predicates.add(builder.equal(root.get("phoneSearchHash"), phoneHash));
            if (normalizedStatus != null) predicates.add(builder.equal(root.get("status"), normalizedStatus));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        var result = repository.findAll(
                specification,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).map(this::response);
        return PageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public UserResponse get(UUID userUid) {
        AppUser user = findRequired(userUid);
        return response(user);
    }

    @Transactional
    public UserResponse create(UserCreateRequest request, String actor) {
        NormalizedPersonalData normalized = normalize(request.name(), request.phone(), request.email());
        assertUnique(normalized, null);
        PasswordService.PasswordHash password = hashPassword(request.password());
        EncryptedValue encryptedName = encrypt(normalized.name());
        EncryptedValue encryptedPhone = encrypt(normalized.phone());
        EncryptedValue encryptedEmail = encrypt(normalized.email());
        try {
            AppUser user = new AppUser(
                    UUID.randomUUID(),
                    encryptedName.ciphertext(), encryptedName.iv(), maskName(normalized.name()),
                    lookupHash(NAME_LOOKUP_DOMAIN, normalizeName(normalized.name())),
                    encryptedPhone.ciphertext(), encryptedPhone.iv(), maskPhone(normalized.phone()),
                    lookupHash(PHONE_LOOKUP_DOMAIN, normalized.phoneDigits()),
                    encryptedEmail.ciphertext(), encryptedEmail.iv(), maskEmail(normalized.email()),
                    lookupHash(EMAIL_LOOKUP_DOMAIN, normalized.email()),
                    password.hash(), password.salt(), password.algorithm(), password.iterations(), actor
            );
            user.updateIntegrityHash(calculateIntegrity(user));
            saveWithUniqueConstraintHandling(user);
            auditLogService.append(actor, "USER_CREATE", "APP_USER", user.getUserUid().toString(),
                    "개인정보 암호화 사용자 등록");
            return UserResponse.from(user, true);
        } finally {
            encryptedName.clear();
            encryptedPhone.clear();
            encryptedEmail.clear();
        }
    }

    @Transactional
    public UserResponse update(UUID userUid, UserUpdateRequest request, String actor) {
        AppUser user = findForUpdate(userUid);
        assertIntegrity(user);
        NormalizedPersonalData normalized = normalize(request.name(), request.phone(), request.email());
        assertUnique(normalized, userUid);
        EncryptedValue encryptedName = encrypt(normalized.name());
        EncryptedValue encryptedPhone = encrypt(normalized.phone());
        EncryptedValue encryptedEmail = encrypt(normalized.email());
        try {
            user.replacePersonalData(
                    encryptedName.ciphertext(), encryptedName.iv(), maskName(normalized.name()),
                    lookupHash(NAME_LOOKUP_DOMAIN, normalizeName(normalized.name())),
                    encryptedPhone.ciphertext(), encryptedPhone.iv(), maskPhone(normalized.phone()),
                    lookupHash(PHONE_LOOKUP_DOMAIN, normalized.phoneDigits()),
                    encryptedEmail.ciphertext(), encryptedEmail.iv(), maskEmail(normalized.email()),
                    lookupHash(EMAIL_LOOKUP_DOMAIN, normalized.email()),
                    AppUser.CURRENT_ENCRYPTION_VERSION
            );
            user.updateIntegrityHash(calculateIntegrity(user));
            saveWithUniqueConstraintHandling(user);
            auditLogService.append(actor, "USER_UPDATE", "APP_USER", userUid.toString(),
                    "개인정보 재암호화 및 검색·무결성 HMAC 갱신");
            return UserResponse.from(user, true);
        } finally {
            encryptedName.clear();
            encryptedPhone.clear();
            encryptedEmail.clear();
        }
    }

    @Transactional
    public UserResponse changeStatus(UUID userUid, String requestedStatus, String actor) {
        AppUser user = findForUpdate(userUid);
        assertIntegrity(user);
        String status = normalizeStatus(requestedStatus, false);
        user.changeStatus(status);
        user.updateIntegrityHash(calculateIntegrity(user));
        repository.saveAndFlush(user);
        auditLogService.append(actor, "USER_STATUS_CHANGE", "APP_USER", userUid.toString(),
                "사용자 상태 변경: " + status);
        return response(user);
    }

    @Transactional
    public void resetPassword(UUID userUid, UserPasswordResetRequest request, String actor) {
        AppUser user = findForUpdate(userUid);
        assertIntegrity(user);
        PasswordService.PasswordHash password = hashPassword(request.password());
        user.replacePassword(password.hash(), password.salt(), password.algorithm(), password.iterations());
        user.updateIntegrityHash(calculateIntegrity(user));
        repository.saveAndFlush(user);
        auditLogService.append(actor, "USER_PASSWORD_RESET", "APP_USER", userUid.toString(),
                "PBKDF2 비밀번호 재설정");
    }

    @Transactional
    public UserPlainResponse readPlain(UUID userUid, String reason, String actor) {
        String normalizedReason = normalizeReason(reason);
        AppUser user = findRequired(userUid);
        assertIntegrity(user);
        String name = decrypt(user.getNameCiphertext(), user.getNameIv());
        String phone = decrypt(user.getPhoneCiphertext(), user.getPhoneIv());
        String email = decrypt(user.getEmailCiphertext(), user.getEmailIv());
        auditLogService.append(actor, "USER_VIEW_PLAIN", "APP_USER", userUid.toString(),
                "개인정보 원문 조회 (사유: " + normalizedReason + ")");
        return new UserPlainResponse(userUid, name, phone, email, user.getEncryptionVersion());
    }

    private AppUser findRequired(UUID userUid) {
        return repository.findByUserUid(userUid)
                .orElseThrow(() -> UserOperationException.notFound(userUid));
    }

    private AppUser findForUpdate(UUID userUid) {
        return repository.findForUpdateByUserUid(userUid)
                .orElseThrow(() -> UserOperationException.notFound(userUid));
    }

    private void saveWithUniqueConstraintHandling(AppUser user) {
        try {
            repository.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw UserOperationException.duplicate("연락처 또는 이메일");
        }
    }

    private void assertUnique(NormalizedPersonalData data, UUID currentUserUid) {
        String phoneHash = lookupHash(PHONE_LOOKUP_DOMAIN, data.phoneDigits());
        String emailHash = lookupHash(EMAIL_LOOKUP_DOMAIN, data.email());
        boolean phoneExists = currentUserUid == null
                ? repository.existsByPhoneSearchHash(phoneHash)
                : repository.existsByPhoneSearchHashAndUserUidNot(phoneHash, currentUserUid);
        if (phoneExists) throw UserOperationException.duplicate("연락처");
        boolean emailExists = currentUserUid == null
                ? repository.existsByEmailSearchHash(emailHash)
                : repository.existsByEmailSearchHashAndUserUidNot(emailHash, currentUserUid);
        if (emailExists) throw UserOperationException.duplicate("이메일");
    }

    private PasswordService.PasswordHash hashPassword(String rawPassword) {
        char[] password = rawPassword.toCharArray();
        try {
            return passwordService.hash(password);
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    private EncryptedValue encrypt(String value) {
        byte[] plaintext = value.getBytes(StandardCharsets.UTF_8);
        try {
            CryptoUtil.EncryptedPayload payload = cryptoUtil.encrypt(plaintext);
            return new EncryptedValue(payload.ciphertext(), payload.iv());
        } finally {
            Arrays.fill(plaintext, (byte) 0);
        }
    }

    private String decrypt(byte[] ciphertext, byte[] iv) {
        byte[] plaintext = null;
        try {
            plaintext = cryptoUtil.decrypt(new CryptoUtil.EncryptedPayload(iv, ciphertext));
            return new String(plaintext, StandardCharsets.UTF_8);
        } finally {
            Arrays.fill(ciphertext, (byte) 0);
            Arrays.fill(iv, (byte) 0);
            if (plaintext != null) Arrays.fill(plaintext, (byte) 0);
        }
    }

    private boolean verifyIntegrity(AppUser user) {
        return integrityService.verify(user.getIntegrityHash(), integrityValues(user));
    }

    private UserResponse response(AppUser user) {
        boolean valid = verifyIntegrity(user);
        return UserResponse.from(user, valid);
    }

    private void assertIntegrity(AppUser user) {
        if (!verifyIntegrity(user)) throw UserOperationException.integrityViolation(user.getUserUid());
    }

    private String calculateIntegrity(AppUser user) {
        return integrityService.sign(integrityValues(user));
    }

    private String[] integrityValues(AppUser user) {
        return new String[] {
                USER_INTEGRITY_DOMAIN,
                user.getUserUid().toString(),
                encode(user.getNameCiphertext()), encode(user.getNameIv()), user.getNameMasked(), user.getNameSearchHash(),
                encode(user.getPhoneCiphertext()), encode(user.getPhoneIv()), user.getPhoneMasked(), user.getPhoneSearchHash(),
                encode(user.getEmailCiphertext()), encode(user.getEmailIv()), user.getEmailMasked(), user.getEmailSearchHash(),
                user.getPasswordHash(), user.getPasswordSalt(), user.getPasswordAlgorithm(),
                Integer.toString(user.getPasswordIterations()), user.getStatus(),
                Integer.toString(user.getEncryptionVersion()), user.getCreatedBy()
        };
    }

    private String encode(byte[] value) {
        try {
            return Base64.getEncoder().encodeToString(value);
        } finally {
            Arrays.fill(value, (byte) 0);
        }
    }

    private String lookupHash(String domain, String normalizedValue) {
        return integrityService.sign(domain, normalizedValue);
    }

    private NormalizedPersonalData normalize(String name, String phone, String email) {
        String normalizedName = name.trim().replaceAll("\\s+", " ");
        String normalizedPhone = phone.trim();
        String phoneDigits = normalizePhone(phone);
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        return new NormalizedPersonalData(normalizedName, normalizedPhone, phoneDigits, normalizedEmail);
    }

    private String normalizeName(String name) {
        return name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String normalizePhone(String phone) {
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() < 9 || digits.length() > 15) {
            throw new IllegalArgumentException("연락처 숫자는 9~15자리여야 합니다.");
        }
        return digits;
    }

    private String normalizeStatus(String status, boolean allowAll) {
        if (isBlank(status) || allowAll && "ALL".equalsIgnoreCase(status)) return null;
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!AppUser.ACTIVE.equals(normalized) && !AppUser.INACTIVE.equals(normalized)) {
            throw new IllegalArgumentException("사용자 상태는 ACTIVE 또는 INACTIVE여야 합니다.");
        }
        return normalized;
    }

    private String normalizeReason(String reason) {
        String normalized = reason == null ? "" : reason.trim().replaceAll("[\\r\\n]+", " ");
        if (normalized.length() < 2 || normalized.length() > 200) {
            throw new IllegalArgumentException("조회 사유는 2~200자여야 합니다.");
        }
        return normalized;
    }

    private String maskName(String name) {
        int[] points = name.codePoints().toArray();
        if (points.length == 1) return "*";
        if (points.length == 2) return new String(points, 0, 1) + "*";
        return new String(points, 0, 1) + "*".repeat(points.length - 2) + new String(points, points.length - 1, 1);
    }

    private String maskPhone(String phone) {
        String digits = normalizePhone(phone);
        if (digits.length() == 11) return digits.substring(0, 3) + "-****-" + digits.substring(7);
        int visiblePrefix = Math.min(3, digits.length() - 4);
        return digits.substring(0, visiblePrefix) + "-****-" + digits.substring(digits.length() - 4);
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        String local = at < 0 ? email : email.substring(0, at);
        String domain = at < 0 ? "" : email.substring(at);
        String visible = local.substring(0, Math.min(2, local.length()));
        return visible + "***" + domain;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record NormalizedPersonalData(String name, String phone, String phoneDigits, String email) {
    }

    private record EncryptedValue(byte[] ciphertext, byte[] iv) {
        private void clear() {
            Arrays.fill(ciphertext, (byte) 0);
            Arrays.fill(iv, (byte) 0);
        }
    }
}
