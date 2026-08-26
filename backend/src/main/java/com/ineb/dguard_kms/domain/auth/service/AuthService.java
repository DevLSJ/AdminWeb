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
        // 계정 존재 여부와 비밀번호 오류를 같은 예외로 처리해 계정 식별 정보 노출을 줄인다.
        var user = userRepository.findByLoginId(request.loginId())
                .filter(candidate -> candidate.isActive())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        char[] password = request.password().toCharArray();
        boolean matches;
        try {
            matches = passwordService.matches(password, user);
        } finally {
            // 인증 직후 가변 버퍼를 지워 평문 비밀번호가 메모리에 머무는 시간을 줄인다.
            Arrays.fill(password, '\0');
        }
        if (!matches) {
            throw new BadCredentialsException("Invalid credentials");
        }

        user.recordLogin();
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
        // 기존 토큰의 만료 시각을 수정하지 않고 새 JWT를 발급하는 sliding session 방식이다.
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
