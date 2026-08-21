package com.ineb.dguard_kms.domain.audit.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditLogResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditVerificationResponse;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;

@RestController
@RequestMapping("/api/audit-logs")
@PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
public class AuditLogController {

    private final AuditLogService service;

    public AuditLogController(AuditLogService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResponse<AuditLogResponse>> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        return ApiResponse.success(
                service.search(from, to, actor, action, Math.max(page, 0), safeSize),
                "감사 로그 조회에 성공했습니다."
        );
    }

    @GetMapping("/verify")
    public ApiResponse<AuditVerificationResponse> verify() {
        return ApiResponse.success(service.verifyChain(), "감사 로그 체인 검증을 완료했습니다.");
    }
}
