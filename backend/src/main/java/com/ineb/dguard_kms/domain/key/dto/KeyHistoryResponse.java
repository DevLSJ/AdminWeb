package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.entity.KeyStatusHistory;

public record KeyHistoryResponse(
        Long id,
        KeyStatus fromStatus,
        KeyStatus toStatus,
        String reason,
        String changedBy,
        Instant changedAt
) {
    public static KeyHistoryResponse from(KeyStatusHistory history) {
        return new KeyHistoryResponse(
                history.getId(), history.getFromStatus(), history.getToStatus(),
                history.getReason(), history.getChangedBy(), history.getChangedAt()
        );
    }
}
