package com.ineb.dguard_kms.domain.key.dto;

import java.util.UUID;

public record KeyRotationResponse(
        UUID keyUid,
        int previousVersion,
        int newVersion,
        KeyResponse key
) {
}
