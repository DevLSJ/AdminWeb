package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 배포 요청")
public record KeyDistributionRequest(
        @Schema(description = "키를 배포할 대상 시스템", example = "payment-api")
        @NotBlank(message = "배포 대상은 필수입니다.") String target,
        @Schema(description = "배포 사유", example = "정기 배포")
        @NotBlank(message = "배포 사유는 필수입니다.") String reason
) {
}
