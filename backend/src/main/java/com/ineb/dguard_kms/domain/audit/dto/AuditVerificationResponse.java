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
        @Schema(description = "기간 마지막 행의 다음 연결 또는 최종 체인 헤드 일치 여부")
        boolean headValid,
        @Schema(description = "검증 범위 시작 시각(UTC). 전체 검증이면 null")
        Instant rangeFrom,
        @Schema(description = "검증 범위 종료 시각(UTC). 전체 검증이면 null")
        Instant rangeTo,
        @Schema(description = "검증 완료 시각(UTC)")
        Instant verifiedAt
) {
}
