package com.ineb.dguard_kms.domain.key.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "복호화 테스트 결과")
public record KeyDecryptResponse(@Schema(description = "복호화된 원문") String plaintext) {
}
