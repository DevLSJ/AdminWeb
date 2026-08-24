package com.ineb.dguard_kms.domain.auth.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.domain.auth.dto.LoginRequest;
import com.ineb.dguard_kms.domain.auth.dto.LoginResponse;
import com.ineb.dguard_kms.domain.auth.dto.MeResponse;
import com.ineb.dguard_kms.domain.auth.service.AuthService;
import com.ineb.dguard_kms.security.AdminUserDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "로그인", description = "로그인 ID와 비밀번호를 검증하고 JWT를 발급합니다.")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request), "로그인되었습니다.");
    }

    @GetMapping("/me")
    @Operation(summary = "내 정보 조회", description = "현재 Bearer 토큰의 사용자 정보를 반환합니다.")
    public ApiResponse<MeResponse> me(@AuthenticationPrincipal AdminUserDetails user) {
        return ApiResponse.success(MeResponse.from(user), "내 정보를 조회했습니다.");
    }

    @PostMapping("/refresh")
    @Operation(summary = "세션 연장", description = "인증된 사용자의 JWT를 새 만료 시각으로 재발급합니다.")
    public ApiResponse<LoginResponse> refresh(@AuthenticationPrincipal AdminUserDetails user) {
        return ApiResponse.success(authService.refresh(user), "세션이 연장되었습니다.");
    }

    @PostMapping("/logout")
    @Operation(summary = "로그아웃", description = "현재 로그인 세션의 로그아웃 감사 기록을 남깁니다.")
    public ApiResponse<Void> logout(Authentication authentication) {
        authService.logout(authentication == null ? null : authentication.getName());
        return ApiResponse.success(null, "로그아웃되었습니다.");
    }
}
