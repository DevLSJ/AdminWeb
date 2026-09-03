package com.ineb.dguard_kms.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UserUpdateRequest(
        @NotBlank(message = "이름을 입력하세요.")
        @Size(max = 64, message = "이름은 64자 이하여야 합니다.")
        String name,
        @NotBlank(message = "연락처를 입력하세요.")
        @Pattern(regexp = "^[0-9+()\\-\\s]{9,20}$", message = "연락처 형식을 확인하세요.")
        String phone,
        @NotBlank(message = "이메일을 입력하세요.")
        @Email(message = "이메일 형식을 확인하세요.")
        @Size(max = 254, message = "이메일은 254자 이하여야 합니다.")
        String email,
        @Pattern(regexp = "ADMIN|CLIENT", message = "권한은 ADMIN 또는 CLIENT여야 합니다.")
        String role
) {
    @Override
    public String toString() {
        return "UserUpdateRequest[personalData=REDACTED]";
    }
}
