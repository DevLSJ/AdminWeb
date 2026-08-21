package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;

public record KeyDistributionRequest(
        @NotBlank(message = "배포 대상은 필수입니다.") String target,
        @NotBlank(message = "배포 사유는 필수입니다.") String reason
) {
}
