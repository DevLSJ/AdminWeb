package com.ineb.dguard_kms.domain.dashboard.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "KMS 대시보드 요약")
public record DashboardSummaryResponse(
        long totalKeys,
        long encryptCapableKeys,
        long decryptCapableKeys,
        long destroyedKeys,
        long integrityViolations,
        long totalOperations,
        long successfulOperations,
        long failedOperations
) { }
