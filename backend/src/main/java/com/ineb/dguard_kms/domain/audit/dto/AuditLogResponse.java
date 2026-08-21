package com.ineb.dguard_kms.domain.audit.dto;

import java.time.Instant;
import java.util.UUID;

import com.ineb.dguard_kms.domain.audit.entity.AuditLog;

public record AuditLogResponse(
        UUID logUid,
        String actor,
        String action,
        String targetType,
        String targetId,
        String detail,
        Instant createdAt,
        boolean chainValid
) {
    public static AuditLogResponse from(AuditLog log, boolean chainValid) {
        return new AuditLogResponse(
                log.getLogUid(), log.getActor(), log.getAction(), log.getTargetType(),
                log.getTargetId(), log.getDetail(), log.getCreatedAt(), chainValid
        );
    }
}
