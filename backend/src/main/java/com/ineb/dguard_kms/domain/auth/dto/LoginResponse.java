package com.ineb.dguard_kms.domain.auth.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "로그인 또는 세션 연장 결과")
public record LoginResponse(
        @Schema(description = "Bearer 인증에 사용할 JWT", example = "eyJhbGciOiJIUzI1NiJ9...")
        String token,
        @Schema(description = "사용자의 고유 UUID")
        UUID userUid,
        @Schema(description = "사용자 로그인 ID", example = "admin")
        String loginId,
        @Schema(description = "사용자 표시 이름", example = "관리자")
        String name,
        @Schema(description = "사용자 역할", allowableValues = { "ADMIN", "CLIENT" }, example = "ADMIN")
        String role
) {
}
