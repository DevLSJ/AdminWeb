package com.ineb.dguard_kms.domain.auth.service;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.crypto.IntegrityService;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountResponse;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountUpdateRequest;
import com.ineb.dguard_kms.domain.auth.entity.AdminUser;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.domain.user.service.UserOperationException;
import com.ineb.dguard_kms.security.PasswordService;

@Service
public class AdminAccountService {
    private static final String DOMAIN_V1 = "ADMIN_USER_ROW_V1";
    private static final String DOMAIN_V2 = "ADMIN_USER_ROW_V2";
    private final AdminUserRepository repository;
    private final IntegrityService integrityService;
    private final CryptoUtil cryptoUtil;
    private final PasswordService passwordService;
    private final AuditLogService auditLogService;

    public AdminAccountService(AdminUserRepository repository, IntegrityService integrityService, CryptoUtil cryptoUtil, PasswordService passwordService, AuditLogService auditLogService) {
        this.repository = repository;
        this.integrityService = integrityService;
        this.cryptoUtil = cryptoUtil;
        this.passwordService = passwordService;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public List<AdminAccountResponse> list() {
        return repository.findAll(Sort.by(Sort.Direction.ASC, "loginId")).stream().map(this::initializeAndMap).toList();
    }

    @Transactional
    public AdminAccountResponse get(UUID userUid) { return initializeAndMap(required(userUid)); }

    @Transactional
    public AdminAccountResponse update(UUID userUid, AdminAccountUpdateRequest request, String actorLoginId) {
        AdminUser target = requiredForUpdate(userUid);
        assertIntegrity(target);
        AdminUser actor = actor(actorLoginId);
        assertCanManage(actor, target);
        String role = request.role() == null ? target.getRole() : request.role();
        if ("S.ADMIN".equals(target.getRole()) && request.role() != null) {
            throw new IllegalArgumentException("S.ADMIN 권한은 시스템 최고 관리자 계정에 고정되어 변경할 수 없습니다.");
        }
        assertRoleAssignable(actor, role);
        target.updateProfile(request.name().trim(), role);
        replaceContactIfPresent(target, request.phone(), request.email());
        resign(target);
        repository.saveAndFlush(target);
        auditLogService.append(actorLoginId, "ADMIN_ACCOUNT_UPDATE", "ADMIN_USER", userUid.toString(), "관리 계정 이름·권한·암호화 연락처 수정");
        return AdminAccountResponse.from(target, true);
    }

    @Transactional
    public AdminAccountResponse changeStatus(UUID userUid, String status, String actorLoginId) {
        AdminUser target = requiredForUpdate(userUid);
        assertIntegrity(target);
        AdminUser actor = actor(actorLoginId);
        assertCanManage(actor, target);
        if (target.getLoginId().equals(actorLoginId) && "INACTIVE".equals(status)) throw new IllegalArgumentException("현재 로그인한 본인 계정은 정지할 수 없습니다.");
        target.changeStatus(status);
        resign(target);
        repository.saveAndFlush(target);
        auditLogService.append(actorLoginId, "ADMIN_ACCOUNT_STATUS_CHANGE", "ADMIN_USER", userUid.toString(), "관리 계정 상태 변경: " + status);
        return AdminAccountResponse.from(target, true);
    }

    @Transactional
    public void resetPassword(UUID userUid, String rawPassword, String actorLoginId) {
        AdminUser target = requiredForUpdate(userUid);
        assertIntegrity(target);
        AdminUser actor = actor(actorLoginId);
        assertCanManage(actor, target);
        char[] password = rawPassword.toCharArray();
        try {
            PasswordService.PasswordHash hash = passwordService.hash(password);
            target.replacePassword(hash.hash(), hash.salt(), hash.algorithm(), hash.iterations());
            resign(target);
            repository.saveAndFlush(target);
            auditLogService.append(actorLoginId, "ADMIN_ACCOUNT_PASSWORD_RESET", "ADMIN_USER", userUid.toString(), "관리 계정 PBKDF2 비밀번호 재설정");
        } finally { Arrays.fill(password, '\0'); }
    }

    private AdminAccountResponse initializeAndMap(AdminUser user) {
        if (user.getIntegrityHash() == null || user.getIntegrityHash().isBlank()) {
            resign(user);
            repository.save(user);
            return AdminAccountResponse.from(user, true);
        }
        if (verifyV2(user)) return AdminAccountResponse.from(user, true);
        if (!hasProtectedContact(user) && verifyV1(user)) {
            resign(user);
            repository.save(user);
            return AdminAccountResponse.from(user, true);
        }
        return AdminAccountResponse.from(user, false);
    }
    private void resign(AdminUser user) { user.updateIntegrityHash(integrityService.sign(valuesV2(user))); }
    private boolean verifyV1(AdminUser user) { return integrityService.verify(user.getIntegrityHash(), valuesV1(user)); }
    private boolean verifyV2(AdminUser user) { return integrityService.verify(user.getIntegrityHash(), valuesV2(user)); }
    private String[] valuesV1(AdminUser user) { return new String[]{DOMAIN_V1, user.getUserUid().toString(), user.getLoginId(), user.getPasswordHash(), user.getPasswordSalt(), user.getPasswordAlgorithm(), Integer.toString(user.getPasswordIterations()), user.getName(), user.getRole(), user.getStatus()}; }
    private String[] valuesV2(AdminUser user) { return new String[]{DOMAIN_V2, user.getUserUid().toString(), user.getLoginId(), user.getPasswordHash(), user.getPasswordSalt(), user.getPasswordAlgorithm(), Integer.toString(user.getPasswordIterations()), user.getName(), encoded(user.getPhoneCiphertext()), encoded(user.getPhoneIv()), text(user.getPhoneMasked()), encoded(user.getEmailCiphertext()), encoded(user.getEmailIv()), text(user.getEmailMasked()), user.getContactEncryptionVersion() == null ? "" : user.getContactEncryptionVersion().toString(), user.getRole(), user.getStatus()}; }
    private void replaceContactIfPresent(AdminUser target, String phoneInput, String emailInput) {
        String phone = normalizePhone(phoneInput);
        String email = normalizeEmail(emailInput);
        ProtectedValue encryptedPhone = phone == null ? null : encrypt(phone);
        ProtectedValue encryptedEmail = email == null ? null : encrypt(email);
        try {
            if (encryptedPhone != null) target.replacePhone(encryptedPhone.ciphertext(), encryptedPhone.iv(), maskPhone(phone));
            if (encryptedEmail != null) target.replaceEmail(encryptedEmail.ciphertext(), encryptedEmail.iv(), maskEmail(email));
        } finally {
            if (encryptedPhone != null) encryptedPhone.clear();
            if (encryptedEmail != null) encryptedEmail.clear();
        }
    }
    private ProtectedValue encrypt(String value) {
        byte[] plaintext = value.getBytes(StandardCharsets.UTF_8);
        try {
            CryptoUtil.EncryptedPayload payload = cryptoUtil.encrypt(plaintext);
            return new ProtectedValue(payload.ciphertext(), payload.iv());
        } finally { Arrays.fill(plaintext, (byte) 0); }
    }
    private String normalizePhone(String value) {
        if (value == null || value.isBlank()) return null;
        String digits = value.replaceAll("\\D", "");
        if (digits.length() < 9 || digits.length() > 15) throw new IllegalArgumentException("연락처는 숫자 9~15자리여야 합니다.");
        return digits;
    }
    private String normalizeEmail(String value) { return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT); }
    private String maskPhone(String phone) { int prefix = Math.min(3, phone.length() - 4); return phone.substring(0, prefix) + "-****-" + phone.substring(phone.length() - 4); }
    private String maskEmail(String email) { int at = email.indexOf('@'); String local = email.substring(0, at); return local.substring(0, Math.min(2, local.length())) + "***" + email.substring(at); }
    private boolean hasProtectedContact(AdminUser user) { return user.getPhoneCiphertext() != null || user.getEmailCiphertext() != null; }
    private void assertIntegrity(AdminUser user) {
        if (user.getIntegrityHash() == null || user.getIntegrityHash().isBlank()) { resign(user); return; }
        if (verifyV2(user) || (!hasProtectedContact(user) && verifyV1(user))) return;
        throw UserOperationException.integrityViolation(user.getUserUid());
    }
    private String encoded(byte[] value) { return value == null ? "" : Base64.getEncoder().encodeToString(value); }
    private String text(String value) { return value == null ? "" : value; }
    private AdminUser required(UUID uid) { return repository.findByUserUid(uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "관리 계정을 찾을 수 없습니다.")); }
    private AdminUser requiredForUpdate(UUID uid) { return repository.findForUpdateByUserUid(uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "관리 계정을 찾을 수 없습니다.")); }
    private AdminUser actor(String loginId) { return repository.findByLoginId(loginId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)); }
    private void assertCanManage(AdminUser actor, AdminUser target) { if ("S.ADMIN".equals(actor.getRole())) return; if ("ADMIN".equals(actor.getRole()) && "CLIENT".equals(target.getRole())) return; throw forbidden(); }
    private void assertRoleAssignable(AdminUser actor, String role) { if (!"ADMIN".equals(role) || "S.ADMIN".equals(actor.getRole())) return; throw forbidden(); }
    private UserOperationException forbidden() { return UserOperationException.forbidden("해당 계정을 관리할 권한이 없습니다."); }

    private record ProtectedValue(byte[] ciphertext, byte[] iv) {
        private void clear() { Arrays.fill(ciphertext, (byte) 0); Arrays.fill(iv, (byte) 0); }
    }
}
