package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.NotBlank;

public record KeyEncryptRequest(@NotBlank(message = "평문은 필수입니다.") String plaintext) {
}
