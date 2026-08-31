package com.ineb.dguard_kms.domain.user.dto;

import java.util.UUID;

public record UserPlainResponse(
        UUID userUid,
        String name,
        String phone,
        String email,
        int encVer
) {
    @Override
    public String toString() {
        return "UserPlainResponse[userUid=" + userUid + ", personalData=REDACTED, encVer=" + encVer + "]";
    }
}
