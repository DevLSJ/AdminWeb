package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "자동 키 갱신 정책 변경 요청")
public record KeyRotationPolicyRequest(
        @Schema(description = "자동 갱신 주기(일). 1~3650 범위", example = "90")
        @Min(1) @Max(3650) Integer days
) {
}
