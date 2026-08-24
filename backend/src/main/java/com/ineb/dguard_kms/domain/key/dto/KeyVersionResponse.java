package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;

import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 재료 버전 정보")
public record KeyVersionResponse(
        @Schema(description = "키 버전", example = "2")
        int version,
        @Schema(description = "버전 상태", example = "ACTIVE")
        String status,
        @Schema(description = "버전 생성 시각(UTC)")
        Instant createdAt,
        @Schema(description = "버전을 생성한 로그인 ID")
        String createdBy,
        @Schema(description = "복호화 전용 여부", example = "false")
        boolean decryptOnly
) {
    public static KeyVersionResponse from(KeyMaterial material) {
        return new KeyVersionResponse(
                material.getKeyVersion(),
                KeyMaterial.RETIRED.equals(material.getMaterialStatus()) ? "DEPRECATED" : material.getMaterialStatus(),
                material.getCreatedAt(),
                material.getCreatedBy(), KeyMaterial.RETIRED.equals(material.getMaterialStatus())
        );
    }
}
