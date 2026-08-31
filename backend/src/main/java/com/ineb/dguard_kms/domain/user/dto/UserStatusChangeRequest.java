package com.ineb.dguard_kms.domain.user.dto;

import jakarta.validation.constraints.NotBlank;

public record UserStatusChangeRequest(
        @NotBlank(message = "변경할 사용자 상태를 입력하세요.")
        String status
) {
}
