package com.ineb.dguard_kms.domain.key.dto;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record KeyStatusChangeRequest(
        @NotNull(message = "변경 상태는 필수입니다.") KeyStatus toStatus,
        @NotBlank(message = "상태 변경 사유는 필수입니다.") String reason
) {
}
