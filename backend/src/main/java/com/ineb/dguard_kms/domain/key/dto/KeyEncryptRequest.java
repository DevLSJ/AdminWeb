package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "암호화 테스트 요청")
public record KeyEncryptRequest(
        @Schema(description = "암호화할 원문", example = "D'Guard KMS")
        @NotBlank(message = "평문은 필수입니다.") String plaintext
) {
}
