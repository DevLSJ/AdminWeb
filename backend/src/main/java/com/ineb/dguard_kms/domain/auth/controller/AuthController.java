package com.ineb.dguard_kms.domain.auth.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.domain.auth.dto.LoginRequest;
import com.ineb.dguard_kms.domain.auth.dto.LoginResponse;
import com.ineb.dguard_kms.domain.auth.dto.MeResponse;
import com.ineb.dguard_kms.domain.auth.service.AuthService;
import com.ineb.dguard_kms.security.AdminUserDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.success(authService.login(request), "로그인되었습니다.");
    }

    @GetMapping("/me")
    public ApiResponse<MeResponse> me(@AuthenticationPrincipal AdminUserDetails user) {
        return ApiResponse.success(MeResponse.from(user), "내 정보를 조회했습니다.");
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        return ApiResponse.success(null, "로그아웃되었습니다.");
    }
}
