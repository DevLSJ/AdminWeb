package com.ineb.dguard_kms.domain.key.dto;

import java.util.List;
import java.util.UUID;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키별 무결성 검증 결과")
public record KeyIntegrityItemResponse(
        UUID keyUid,
        String keyName,
        KeyStatus status,
        boolean valid,
        List<Integer> invalidVersions,
        List<String> violations
) { }
