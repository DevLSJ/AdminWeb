package com.ineb.dguard_kms.domain.auth.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

import com.ineb.dguard_kms.security.AdminUserDetails;

@Schema(description = "현재 인증된 사용자 정보")
public record MeResponse(
        @Schema(description = "사용자의 고유 UUID")
        UUID userUid,
        @Schema(description = "사용자 로그인 ID", example = "admin")
        String loginId,
        @Schema(description = "사용자 표시 이름", example = "관리자")
        String name,
        @Schema(description = "사용자 역할", allowableValues = { "ADMIN", "CLIENT" }, example = "ADMIN")
        String role
) {
    public static MeResponse from(AdminUserDetails user) {
        return new MeResponse(user.getUserUid(), user.getUsername(), user.getName(), user.getRole());
    }
}
