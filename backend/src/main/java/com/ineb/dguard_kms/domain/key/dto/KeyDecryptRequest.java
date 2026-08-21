package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;

public record KeyDecryptRequest(
        @NotBlank(message = "암호문은 필수입니다.") String ciphertext,
        @NotBlank(message = "IV는 필수입니다.") String iv
) {
}
