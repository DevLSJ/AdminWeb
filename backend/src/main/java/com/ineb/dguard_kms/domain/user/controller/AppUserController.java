package com.ineb.dguard_kms.domain.user.controller;

import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.user.dto.UserCreateRequest;
import com.ineb.dguard_kms.domain.user.dto.UserPasswordResetRequest;
import com.ineb.dguard_kms.domain.user.dto.UserPlainResponse;
import com.ineb.dguard_kms.domain.user.dto.UserResponse;
import com.ineb.dguard_kms.domain.user.dto.UserStatusChangeRequest;
import com.ineb.dguard_kms.domain.user.dto.UserUpdateRequest;
import com.ineb.dguard_kms.domain.user.service.AppUserService;
import com.ineb.dguard_kms.security.AdminUserDetails;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
@Tag(name = "User management", description = "마스터키 암호화 개인정보 사용자 관리")
public class AppUserController {

    private final AppUserService service;

    public AppUserController(AppUserService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "사용자 마스킹 목록 조회")
    public ApiResponse<PageResponse<UserResponse>> search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        return ApiResponse.success(
                service.search(name, phone, status, Math.max(page, 0), safeSize),
                "사용자 목록을 마스킹하여 조회했습니다."
        );
    }

    @GetMapping("/{userUid}")
    @Operation(summary = "사용자 마스킹 상세 조회")
    public ApiResponse<UserResponse> get(@PathVariable UUID userUid) {
        return ApiResponse.success(service.get(userUid), "사용자 상세를 마스킹하여 조회했습니다.");
    }

    @PostMapping
    @Operation(summary = "암호화 사용자 등록")
    public ApiResponse<UserResponse> create(
            @Valid @RequestBody UserCreateRequest request,
            @AuthenticationPrincipal AdminUserDetails actor
    ) {
        return ApiResponse.success(service.create(request, actor.getUsername()), "사용자를 안전하게 등록했습니다.");
    }

    @PutMapping("/{userUid}")
    @Operation(summary = "사용자 개인정보 재암호화 수정")
    public ApiResponse<UserResponse> update(
            @PathVariable UUID userUid,
            @Valid @RequestBody UserUpdateRequest request,
            @AuthenticationPrincipal AdminUserDetails actor
    ) {
        return ApiResponse.success(service.update(userUid, request, actor.getUsername()), "사용자 정보를 수정했습니다.");
    }

    @PatchMapping("/{userUid}/status")
    @Operation(summary = "사용자 상태 변경")
    public ApiResponse<UserResponse> changeStatus(
            @PathVariable UUID userUid,
            @Valid @RequestBody UserStatusChangeRequest request,
            @AuthenticationPrincipal AdminUserDetails actor
    ) {
        return ApiResponse.success(
                service.changeStatus(userUid, request.status(), actor.getUsername()),
                "사용자 상태를 변경했습니다."
        );
    }

    @PatchMapping("/{userUid}/password")
    @Operation(summary = "사용자 비밀번호 재설정")
    public ApiResponse<Void> resetPassword(
            @PathVariable UUID userUid,
            @Valid @RequestBody UserPasswordResetRequest request,
            @AuthenticationPrincipal AdminUserDetails actor
    ) {
        service.resetPassword(userUid, request, actor.getUsername());
        return ApiResponse.success(null, "사용자 비밀번호를 재설정했습니다.");
    }

    @GetMapping("/{userUid}/plain")
    @Operation(summary = "개인정보 원문 조회", description = "조회 사유를 필수로 기록하고 응답 캐시를 금지합니다.")
    public ResponseEntity<ApiResponse<UserPlainResponse>> readPlain(
            @PathVariable UUID userUid,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal AdminUserDetails actor
    ) {
        UserPlainResponse response = service.readPlain(userUid, reason, actor.getUsername());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .body(ApiResponse.success(response, "개인정보 원문을 조회하고 감사 로그를 기록했습니다."));
    }
}
