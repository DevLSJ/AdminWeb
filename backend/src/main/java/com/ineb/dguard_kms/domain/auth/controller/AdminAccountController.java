package com.ineb.dguard_kms.domain.auth.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountResponse;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountStatusRequest;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountUpdateRequest;
import com.ineb.dguard_kms.domain.auth.service.AdminAccountService;
import com.ineb.dguard_kms.domain.user.dto.UserPasswordResetRequest;
import com.ineb.dguard_kms.security.AdminUserDetails;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/admin-accounts")
@PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
@Tag(name = "Admin accounts")
public class AdminAccountController {

    private final AdminAccountService service;

    public AdminAccountController(AdminAccountService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "관리 계정 조회", description = "admin_user 테이블의 계정을 비밀번호 관련 필드 없이 조회합니다.")
    public ApiResponse<List<AdminAccountResponse>> list() {
        return ApiResponse.success(service.list(), "관리 계정 조회에 성공했습니다.");
    }

    @GetMapping("/{userUid}")
    public ApiResponse<AdminAccountResponse> get(@PathVariable java.util.UUID userUid) {
        return ApiResponse.success(service.get(userUid), "관리 계정 상세를 조회했습니다.");
    }

    @PutMapping("/{userUid}")
    public ApiResponse<AdminAccountResponse> update(@PathVariable java.util.UUID userUid, @Valid @RequestBody AdminAccountUpdateRequest request, @AuthenticationPrincipal AdminUserDetails actor) {
        return ApiResponse.success(service.update(userUid, request, actor.getUsername()), "관리 계정을 수정했습니다.");
    }

    @PatchMapping("/{userUid}/status")
    public ApiResponse<AdminAccountResponse> changeStatus(@PathVariable java.util.UUID userUid, @Valid @RequestBody AdminAccountStatusRequest request, @AuthenticationPrincipal AdminUserDetails actor) {
        return ApiResponse.success(service.changeStatus(userUid, request.status(), actor.getUsername()), "관리 계정 상태를 변경했습니다.");
    }

    @PostMapping("/{userUid}/password")
    public ApiResponse<Void> resetPassword(@PathVariable java.util.UUID userUid, @Valid @RequestBody UserPasswordResetRequest request, @AuthenticationPrincipal AdminUserDetails actor) {
        service.resetPassword(userUid, request.password(), actor.getUsername());
        return ApiResponse.success(null, "관리 계정 비밀번호를 재설정했습니다.");
    }
}
