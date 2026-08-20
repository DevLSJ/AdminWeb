package com.ineb.dguard_kms.domain.auth.dto;

import java.util.UUID;

public record LoginResponse(
        String token,
        UUID userUid,
        String loginId,
        String name,
        String role
) {
}
