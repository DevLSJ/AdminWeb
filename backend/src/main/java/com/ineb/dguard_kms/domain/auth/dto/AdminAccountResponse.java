package com.ineb.dguard_kms.domain.auth.dto;

import java.time.Instant;
import java.util.UUID;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

public record AdminAccountResponse(
        UUID userUid,
        String loginId,
        String name,
        String phoneMasked,
        String emailMasked,
        String role,
        String status,
        boolean integrityValid,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static AdminAccountResponse from(AdminUser user) {
        return new AdminAccountResponse(
                user.getUserUid(), user.getLoginId(), user.getName(), user.getPhoneMasked(), user.getEmailMasked(),
                user.getRole(), user.getStatus(), true,
                user.getCreatedAt(), user.getUpdatedAt(), user.getLastLoginAt()
        );
    }

    public static AdminAccountResponse from(AdminUser user, boolean integrityValid) {
        return new AdminAccountResponse(
                user.getUserUid(), user.getLoginId(), user.getName(), user.getPhoneMasked(), user.getEmailMasked(),
                user.getRole(), user.getStatus(), integrityValid,
                user.getCreatedAt(), user.getUpdatedAt(), user.getLastLoginAt()
        );
    }
}
