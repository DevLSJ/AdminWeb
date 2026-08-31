package com.ineb.dguard_kms.domain.audit.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "감사 로그 해시 체인 검증 결과")
public record AuditVerificationResponse(
        @Schema(description = "전체 체인의 유효 여부", example = "true")
        boolean valid,
        @Schema(description = "검증한 로그 수", example = "42")
        long checkedCount,
        @Schema(description = "무결성이 실패한 로그 UUID 목록")
        List<UUID> invalidLogUids,
        @Schema(description = "저장된 체인 헤드와 계산된 마지막 해시의 일치 여부")
        boolean headValid,
        @Schema(description = "검증 완료 시각(UTC)")
        Instant verifiedAt
) {
}
