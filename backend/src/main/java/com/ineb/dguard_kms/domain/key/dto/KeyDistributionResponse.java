package com.ineb.dguard_kms.domain.key.dto;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

import java.time.Instant;
import java.util.UUID;

public record KeyDistributionResponse(
        UUID keyUid,
        int version,
        String target,
        KeyStatus status,
        Instant distributedAt
) {
}
