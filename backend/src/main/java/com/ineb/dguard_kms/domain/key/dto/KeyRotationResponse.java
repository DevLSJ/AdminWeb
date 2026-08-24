package com.ineb.dguard_kms.domain.key.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 갱신 결과")
public record KeyRotationResponse(
        @Schema(description = "갱신한 키 UUID")
        UUID keyUid,
        @Schema(description = "갱신 전 버전", example = "1")
        int previousVersion,
        @Schema(description = "새 버전", example = "2")
        int newVersion,
        @Schema(description = "갱신 후 키 메타데이터")
        KeyResponse key
) {
}
