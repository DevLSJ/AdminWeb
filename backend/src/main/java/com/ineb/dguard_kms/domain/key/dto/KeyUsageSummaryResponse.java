package com.ineb.dguard_kms.domain.key.dto;

public record KeyUsageSummaryResponse(
        long total,
        long success,
        long failure,
        long encrypt,
        long decrypt
) {
}
