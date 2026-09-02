package com.ineb.dguard_kms.domain.audit.controller;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditLogResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditEntryVerificationResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditVerificationResponse;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.security.AdminUserDetails;

@RestController
@RequestMapping("/api/audit-logs")
@PreAuthorize("hasAnyRole('ADMIN', 'S.ADMIN')")
@Tag(name = "Audit logs")
public class AuditLogController {

    private final AuditLogService service;

    public AuditLogController(AuditLogService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "감사 로그 검색", description = "기간, 행위자, 작업 유형으로 감사 로그를 페이지 단위로 조회합니다.")
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
    @Operation(summary = "감사 로그 기간 체인 검증", description = "선택 기간의 행 HMAC과 범위 앞뒤 연결을 검증합니다. 기간을 생략하면 전체 체인을 검증합니다.")
    public ApiResponse<AuditVerificationResponse> verify(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        return ApiResponse.success(service.verifyChain(from, to), "감사 로그 체인 검증을 완료했습니다.");
    }

    @GetMapping("/{logUid}/verify")
    @Operation(summary = "개별 감사 로그 체인 검증", description = "선택한 행의 HMAC과 앞뒤 prev_hash 연결 및 마지막 행의 체인 헤드를 검증합니다.")
    public ApiResponse<AuditEntryVerificationResponse> verifyEntry(@PathVariable UUID logUid) {
        return ApiResponse.success(service.verifyEntry(logUid), "선택한 감사 로그 구간 검증을 완료했습니다.");
    }

    @GetMapping("/export")
    @Operation(summary = "감사 로그 CSV 내보내기", description = "검색 조건에 맞는 감사 로그와 체인 해시를 CSV로 내보냅니다.")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String action,
            @AuthenticationPrincipal AdminUserDetails currentUser
    ) {
        byte[] csv = service.exportCsv(from, to, actor, action, currentUser.getUsername());
        String filename = "audit-logs-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .contentLength(csv.length)
                .body(csv);
    }
}
