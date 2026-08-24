package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 메타데이터와 무결성 검증 결과")
public record KeyResponse(
        @Schema(description = "키 고유 UUID")
        UUID keyUid,
        @Schema(description = "키 이름", example = "payment-encryption-key")
        String keyName,
        @Schema(description = "암호 알고리즘", example = "AES")
        String algorithm,
        @Schema(description = "키 길이(비트)", example = "256")
        int keySize,
        @Schema(description = "키 사용 목적", example = "PAYMENT_ENCRYPTION")
        String purpose,
        @Schema(description = "키 수명주기 상태", example = "ACTIVE")
        KeyStatus status,
        @Schema(description = "현재 키 버전", example = "1")
        int version,
        @Schema(description = "만료일(yyyy-MM-dd)")
        LocalDate expireAt,
        @Schema(description = "자동 갱신 주기(일). 미설정 시 null", nullable = true)
        Integer autoRotationDays,
        @Schema(description = "저장된 키 재료의 무결성 검증 결과", example = "true")
        boolean integrityValid,
        @Schema(description = "키 생성 시각(UTC)")
        Instant createdAt,
        @Schema(description = "키 최종 수정 시각(UTC)")
        Instant updatedAt
) {
    public static KeyResponse from(CryptoKey key, boolean integrityValid) {
        return new KeyResponse(
                key.getKeyUid(),
                key.getKeyName(),
                key.getAlgorithm(),
                key.getKeySize(),
                key.getPurpose(),
                key.getStatus(),
                key.getCurrentVersion(),
                key.getExpireAt(),
                key.getAutoRotationDays(),
                integrityValid,
                key.getCreatedAt(),
                key.getUpdatedAt()
        );
    }
}
