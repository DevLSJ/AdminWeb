package com.ineb.dguard_kms.domain.auth.dto;

import java.util.UUID;

import com.ineb.dguard_kms.security.AdminUserDetails;

public record MeResponse(
        UUID userUid,
        String loginId,
        String name,
        String role
) {
    public static MeResponse from(AdminUserDetails user) {
        return new MeResponse(user.getUserUid(), user.getUsername(), user.getName(), user.getRole());
    }
}
