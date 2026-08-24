package com.ineb.dguard_kms.domain.key.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "암호화 테스트 결과")
public record KeyEncryptResponse(
        @Schema(description = "Base64 인코딩 AES-GCM 암호문") String ciphertext,
        @Schema(description = "Base64 인코딩 초기화 벡터(IV)") String iv,
        @Schema(description = "암호문과 IV 인코딩", example = "Base64") String encoding
) {
}
