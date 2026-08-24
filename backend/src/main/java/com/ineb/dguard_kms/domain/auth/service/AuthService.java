package com.ineb.dguard_kms.domain.auth.service;

import java.util.Arrays;

import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.domain.auth.dto.LoginRequest;
import com.ineb.dguard_kms.domain.auth.dto.LoginResponse;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.security.AdminUserDetails;
import com.ineb.dguard_kms.security.JwtTokenProvider;
import com.ineb.dguard_kms.security.PasswordService;

@Service
public class AuthService {

    private final AdminUserRepository userRepository;
    private final PasswordService passwordService;
    private final JwtTokenProvider tokenProvider;
    private final AuditLogService auditLogService;

    public AuthService(
            AdminUserRepository userRepository,
            PasswordService passwordService,
            JwtTokenProvider tokenProvider,
            AuditLogService auditLogService
    ) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.tokenProvider = tokenProvider;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        var user = userRepository.findByLoginId(request.loginId())
                .filter(candidate -> candidate.isActive())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        char[] password = request.password().toCharArray();
        boolean matches;
        try {
            matches = passwordService.matches(password, user);
        } finally {
            Arrays.fill(password, '\0');
        }
        if (!matches) {
            throw new BadCredentialsException("Invalid credentials");
        }

        AdminUserDetails details = new AdminUserDetails(user);
        auditLogService.append(details.getUsername(), "LOGIN", "ADMIN_USER", details.getUsername(), "로그인 성공");
        return new LoginResponse(
                tokenProvider.createToken(details),
                details.getUserUid(),
                details.getUsername(),
                details.getName(),
                details.getRole()
        );
    }

    @Transactional
    public LoginResponse refresh(AdminUserDetails details) {
        auditLogService.append(details.getUsername(), "SESSION_REFRESH", "ADMIN_USER", details.getUsername(), "세션 연장");
        return new LoginResponse(
                tokenProvider.createToken(details),
                details.getUserUid(),
                details.getUsername(),
                details.getName(),
                details.getRole()
        );
    }

    @Transactional
    public void logout(String actor) {
        if (actor != null && !actor.isBlank()) {
            auditLogService.append(actor, "LOGOUT", "ADMIN_USER", actor, "로그아웃");
        }
    }
}
