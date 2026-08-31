package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.entity.KeyStatusHistory;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 상태 변경 이력")
public record KeyHistoryResponse(
        @Schema(description = "이력 식별자")
        Long id,
        @Schema(description = "변경 전 키 상태", nullable = true)
        KeyStatus fromStatus,
        @Schema(description = "변경 후 키 상태")
        KeyStatus toStatus,
        @Schema(description = "생명주기 작업 유형", example = "KEY_ROTATE")
        String operation,
        @Schema(description = "작업 당시 암호 키 버전", example = "2")
        int keyVersion,
        @Schema(description = "상태 변경 사유")
        String reason,
        @Schema(description = "상태를 변경한 로그인 ID")
        String changedBy,
        @Schema(description = "상태 변경 시각(UTC)")
        Instant changedAt
) {
    public static KeyHistoryResponse from(KeyStatusHistory history) {
        return new KeyHistoryResponse(
                history.getId(), history.getFromStatus(), history.getToStatus(),
                history.getOperation(), history.getKeyVersion(),
                history.getReason(), history.getChangedBy(), history.getChangedAt()
        );
    }
}
