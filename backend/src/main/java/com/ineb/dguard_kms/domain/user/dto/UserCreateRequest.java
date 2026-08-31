package com.ineb.dguard_kms.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "암호화 저장할 사용자 등록 요청")
public record UserCreateRequest(
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

        @NotBlank(message = "초기 비밀번호를 입력하세요.")
        @Size(min = 8, max = 128, message = "비밀번호는 8~128자여야 합니다.")
        String password
) {
    @Override
    public String toString() {
        return "UserCreateRequest[personalData=REDACTED, password=REDACTED]";
    }
}
