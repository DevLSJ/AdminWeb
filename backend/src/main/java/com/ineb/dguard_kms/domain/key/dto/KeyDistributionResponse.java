package com.ineb.dguard_kms.domain.key.dto;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 배포 결과")
public record KeyDistributionResponse(
        @Schema(description = "배포한 키 UUID")
        UUID keyUid,
        @Schema(description = "배포한 키 버전", example = "2")
        int version,
        @Schema(description = "배포 대상", example = "payment-api")
        String target,
        @Schema(description = "배포 후 유지되는 생명주기 상태", example = "ACTIVE")
        KeyStatus status,
        @Schema(description = "배포 완료 시각(UTC)")
        Instant distributedAt
) {
}
