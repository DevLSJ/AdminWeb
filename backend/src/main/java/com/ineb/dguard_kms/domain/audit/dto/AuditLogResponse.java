package com.ineb.dguard_kms.domain.audit.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

import com.ineb.dguard_kms.domain.audit.entity.AuditLog;

@Schema(description = "감사 로그 한 건")
public record AuditLogResponse(
        @Schema(description = "감사 로그 고유 UUID")
        UUID logUid,
        @Schema(description = "작업을 수행한 로그인 ID", example = "admin")
        String actor,
        @Schema(description = "수행한 작업 코드", example = "KEY_CREATE")
        String action,
        @Schema(description = "대상 리소스 유형", example = "KEY")
        String targetType,
        @Schema(description = "대상 리소스 식별자")
        String targetId,
        @Schema(description = "작업 상세 내용")
        String detail,
        @Schema(description = "로그 생성 시각(UTC)")
        Instant createdAt,
        @Schema(description = "해시 체인 무결성 검증 결과", example = "true")
        boolean chainValid
) {
    public static AuditLogResponse from(AuditLog log, boolean chainValid) {
        return new AuditLogResponse(
                log.getLogUid(), log.getActor(), log.getAction(), log.getTargetType(),
                log.getTargetId(), log.getDetail(), log.getCreatedAt(), chainValid
        );
    }
}
