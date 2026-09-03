package com.ineb.dguard_kms.domain.user.dto;

import java.time.Instant;
import java.util.UUID;

import com.ineb.dguard_kms.domain.auth.dto.AdminAccountResponse;

public record ManagedUserResponse(
        String accountType,
        UUID userUid,
        String loginId,
        String nameDisplay,
        String phoneMasked,
        String emailMasked,
        String role,
        String status,
        boolean integrityValid,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static ManagedUserResponse from(AdminAccountResponse account) {
        return new ManagedUserResponse(
                "ADMIN_ACCOUNT", account.userUid(), account.loginId(), account.name(), null, null,
                account.role(), account.status(), account.integrityValid(), account.createdAt(),
                account.updatedAt(), account.lastLoginAt()
        );
    }

    public static ManagedUserResponse from(UserResponse user) {
        return new ManagedUserResponse(
                "APP_USER", user.userUid(), null, user.nameMasked(), user.phoneMasked(), user.emailMasked(),
                user.role(), user.status(), user.integrityValid(), user.createdAt(), user.updatedAt(), null
        );
    }
}
