package com.ineb.dguard_kms.domain.key.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 사용 통계")
public record KeyUsageSummaryResponse(
        @Schema(description = "전체 사용 횟수", example = "120")
        long total,
        @Schema(description = "성공 횟수", example = "118")
        long success,
        @Schema(description = "실패 횟수", example = "2")
        long failure,
        @Schema(description = "암호화 횟수", example = "70")
        long encrypt,
        @Schema(description = "복호화 횟수", example = "50")
        long decrypt
) {
}
