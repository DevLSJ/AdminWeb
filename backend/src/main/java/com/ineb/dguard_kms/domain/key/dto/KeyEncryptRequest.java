package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "암호화 테스트 요청")
public record KeyEncryptRequest(
        @Schema(description = "암호화할 원문", example = "D'Guard KMS")
        @NotBlank(message = "평문은 필수입니다.") String plaintext,
        @Schema(description = "암호화에 사용할 키 버전. 생략 시 현재 버전", example = "2")
        @Positive(message = "키 버전은 1 이상이어야 합니다.") Integer version
) {
    public KeyEncryptRequest(String plaintext) {
        this(plaintext, null);
    }

    @Override
    public String toString() {
        return "KeyEncryptRequest[plaintext=REDACTED, version=" + version + "]";
    }
}
