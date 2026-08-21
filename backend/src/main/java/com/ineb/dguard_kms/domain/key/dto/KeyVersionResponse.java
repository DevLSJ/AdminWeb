package com.ineb.dguard_kms.domain.key.dto;

import java.time.Instant;

import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;

public record KeyVersionResponse(
        int version,
        String status,
        Instant createdAt,
        String createdBy,
        boolean decryptOnly
) {
    public static KeyVersionResponse from(KeyMaterial material) {
        return new KeyVersionResponse(
                material.getKeyVersion(),
                KeyMaterial.RETIRED.equals(material.getMaterialStatus()) ? "DEPRECATED" : material.getMaterialStatus(),
                material.getCreatedAt(),
                material.getCreatedBy(), KeyMaterial.RETIRED.equals(material.getMaterialStatus())
        );
    }
}
