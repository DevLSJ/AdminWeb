package com.ineb.dguard_kms.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UserPlainViewRequest(
        @NotBlank(message = "개인정보 원문 조회 사유를 입력하세요.")
        @Size(min = 2, max = 200, message = "조회 사유는 2~200자여야 합니다.")
        String reason
) {
    @Override
    public String toString() {
        return "UserPlainViewRequest[reason=REDACTED]";
    }
}
