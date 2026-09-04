package com.ineb.dguard_kms.domain.auth.service;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    private static final String DOMAIN = "ADMIN_USER_ROW_V1";
    private final AdminUserRepository repository;
    private final IntegrityService integrityService;
    private final PasswordService passwordService;
    private final AuditLogService auditLogService;

    public AdminAccountService(AdminUserRepository repository, IntegrityService integrityService, PasswordService passwordService, AuditLogService auditLogService) {
        this.repository = repository;
        this.integrityService = integrityService;
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
        AdminUser actor = actor(actorLoginId);
        assertCanManage(actor, target);
        String role = request.role() == null ? target.getRole() : request.role();
        if ("S.ADMIN".equals(target.getRole()) && request.role() != null) {
            throw new IllegalArgumentException("S.ADMIN 권한은 시스템 최고 관리자 계정에 고정되어 변경할 수 없습니다.");
        }
        assertRoleAssignable(actor, role);
        target.updateProfile(request.name().trim(), role);
        resign(target);
        repository.saveAndFlush(target);
        auditLogService.append(actorLoginId, "ADMIN_ACCOUNT_UPDATE", "ADMIN_USER", userUid.toString(), "관리 계정 이름·권한 수정");
        return AdminAccountResponse.from(target, true);
    }

    @Transactional
    public AdminAccountResponse changeStatus(UUID userUid, String status, String actorLoginId) {
        AdminUser target = requiredForUpdate(userUid);
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
        return AdminAccountResponse.from(user, verify(user));
    }
    private void resign(AdminUser user) { user.updateIntegrityHash(integrityService.sign(values(user))); }
    private boolean verify(AdminUser user) { return integrityService.verify(user.getIntegrityHash(), values(user)); }
    private String[] values(AdminUser user) { return new String[]{DOMAIN, user.getUserUid().toString(), user.getLoginId(), user.getPasswordHash(), user.getPasswordSalt(), user.getPasswordAlgorithm(), Integer.toString(user.getPasswordIterations()), user.getName(), user.getRole(), user.getStatus()}; }
    private AdminUser required(UUID uid) { return repository.findByUserUid(uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "관리 계정을 찾을 수 없습니다.")); }
    private AdminUser requiredForUpdate(UUID uid) { return repository.findForUpdateByUserUid(uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "관리 계정을 찾을 수 없습니다.")); }
    private AdminUser actor(String loginId) { return repository.findByLoginId(loginId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)); }
    private void assertCanManage(AdminUser actor, AdminUser target) { if ("S.ADMIN".equals(actor.getRole())) return; if ("ADMIN".equals(actor.getRole()) && "CLIENT".equals(target.getRole())) return; throw forbidden(); }
    private void assertRoleAssignable(AdminUser actor, String role) { if (!"ADMIN".equals(role) || "S.ADMIN".equals(actor.getRole())) return; throw forbidden(); }
    private UserOperationException forbidden() { return UserOperationException.forbidden("해당 계정을 관리할 권한이 없습니다."); }
}
