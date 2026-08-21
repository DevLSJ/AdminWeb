package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

public record KeyResponse(
        UUID keyUid,
        String keyName,
        String algorithm,
        int keySize,
        String purpose,
        KeyStatus status,
        int version,
        LocalDate expireAt,
        boolean integrityValid,
        Instant createdAt,
        Instant updatedAt
) {
    public static KeyResponse from(CryptoKey key, boolean integrityValid) {
        return new KeyResponse(
                key.getKeyUid(),
                key.getKeyName(),
                key.getAlgorithm(),
                key.getKeySize(),
                key.getPurpose(),
                key.getStatus(),
                key.getCurrentVersion(),
                key.getExpireAt(),
                integrityValid,
                key.getCreatedAt(),
                key.getUpdatedAt()
        );
    }
}
