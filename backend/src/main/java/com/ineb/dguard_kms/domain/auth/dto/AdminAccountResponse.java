package com.ineb.dguard_kms.domain.auth.dto;

import java.time.Instant;
import java.util.UUID;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

public record AdminAccountResponse(
        UUID userUid,
        String loginId,
        String name,
        String role,
        String status,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static AdminAccountResponse from(AdminUser user) {
        return new AdminAccountResponse(
                user.getUserUid(), user.getLoginId(), user.getName(), user.getRole(), user.getStatus(),
                user.getCreatedAt(), user.getUpdatedAt(), user.getLastLoginAt()
        );
    }
}
