package com.ineb.dguard_kms.domain.auth.controller;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.domain.auth.dto.AdminAccountResponse;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/admin-accounts")
@PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
@Tag(name = "Admin accounts")
public class AdminAccountController {

    private final AdminUserRepository repository;

    public AdminAccountController(AdminUserRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Operation(summary = "관리 계정 조회", description = "admin_user 테이블의 계정을 비밀번호 관련 필드 없이 조회합니다.")
    public ApiResponse<List<AdminAccountResponse>> list() {
        List<AdminAccountResponse> accounts = repository.findAll(Sort.by(Sort.Direction.ASC, "loginId"))
                .stream().map(AdminAccountResponse::from).toList();
        return ApiResponse.success(accounts, "관리 계정 조회에 성공했습니다.");
    }
}
