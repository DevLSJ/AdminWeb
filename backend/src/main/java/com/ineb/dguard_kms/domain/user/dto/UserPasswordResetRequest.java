package com.ineb.dguard_kms.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

public record UserPasswordResetRequest(
        @NotBlank(message = "새 비밀번호를 입력하세요.")
        @Size(min = 8, max = 128, message = "비밀번호는 8~128자여야 합니다.")
        @Pattern(regexp = ".*[^\\p{L}\\p{N}\\s].*", message = "비밀번호는 특수문자를 포함해야 합니다.")
        String password
) {
    @Override
    public String toString() {
        return "UserPasswordResetRequest[password=REDACTED]";
    }
}
