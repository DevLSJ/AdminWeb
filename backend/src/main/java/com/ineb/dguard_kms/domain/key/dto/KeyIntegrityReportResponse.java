package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "전체 키 무결성 검증 리포트")
public record KeyIntegrityReportResponse(
        Instant checkedAt,
        long totalKeys,
        long validKeys,
        long invalidKeys,
        List<KeyIntegrityItemResponse> keys
) { }
