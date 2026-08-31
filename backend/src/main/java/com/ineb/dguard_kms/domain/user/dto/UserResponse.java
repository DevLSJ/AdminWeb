package com.ineb.dguard_kms.domain.user.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

import com.ineb.dguard_kms.domain.user.entity.AppUser;

@Schema(description = "마스킹된 사용자 응답. 개인정보 원문은 포함하지 않습니다.")
public record UserResponse(
        UUID userUid,
        String nameMasked,
        String phoneMasked,
        String emailMasked,
        String status,
        boolean integrityValid,
        int encVer,
        String createdBy,
        Instant createdAt,
        Instant updatedAt
) {
    public static UserResponse from(AppUser user, boolean integrityValid) {
        return new UserResponse(
                user.getUserUid(), user.getNameMasked(), user.getPhoneMasked(), user.getEmailMasked(),
                user.getStatus(), integrityValid, user.getEncryptionVersion(), user.getCreatedBy(),
                user.getCreatedAt(), user.getUpdatedAt()
        );
    }
}
