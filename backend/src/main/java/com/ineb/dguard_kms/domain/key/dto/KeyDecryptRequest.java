package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "복호화 테스트 요청")
public record KeyDecryptRequest(
        @Schema(description = "Base64로 인코딩된 AES-GCM 암호문")
        @NotBlank(message = "암호문은 필수입니다.") String ciphertext,
        @Schema(description = "Base64로 인코딩된 AES-GCM 초기화 벡터(IV)")
        @NotBlank(message = "IV는 필수입니다.") String iv,
        @Schema(description = "암호화에 사용한 키 버전. 생략 시 현재 버전", example = "1")
        @Positive(message = "키 버전은 1 이상이어야 합니다.") Integer version
) {
}
