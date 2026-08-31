package com.ineb.dguard_kms.domain.key.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "암호화 테스트 결과")
public record KeyEncryptResponse(
        @Schema(description = "Base64 인코딩 암호문") String ciphertext,
        @Schema(description = "Base64 초기화 벡터. RSA에서는 null") String iv,
        @Schema(description = "암호문과 IV 인코딩", example = "Base64") String encoding,
        @Schema(description = "암호화에 사용한 키 버전", example = "2") int version
) {
    @Override
    public String toString() {
        return "KeyEncryptResponse[ciphertext=REDACTED, iv=REDACTED, encoding=" + encoding
                + ", version=" + version + "]";
    }
}
