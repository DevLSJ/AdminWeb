package com.ineb.dguard_kms.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "로그인 요청 정보")
public record LoginRequest(
        @NotBlank(message = "아이디를 입력하세요.")
        @Size(max = 100, message = "아이디는 100자 이하여야 합니다.")
        @Schema(description = "사용자 로그인 ID", example = "admin")
        String loginId,

        @NotBlank(message = "비밀번호를 입력하세요.")
        @Size(max = 200, message = "비밀번호는 200자 이하여야 합니다.")
        @Schema(description = "사용자 비밀번호", format = "password", writeOnly = true)
        String password
) {
}
