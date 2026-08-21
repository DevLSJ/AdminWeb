package com.ineb.dguard_kms.domain.key.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record KeyCreateRequest(
        @NotBlank(message = "키 이름은 필수입니다.") String keyName,
        @NotBlank(message = "알고리즘은 필수입니다.") String algorithm,
        @Min(value = 256, message = "키 길이는 256비트여야 합니다.")
        @Max(value = 256, message = "키 길이는 256비트여야 합니다.") int keySize,
        @NotBlank(message = "키 용도는 필수입니다.") String purpose,
        @Future(message = "만료일은 미래 날짜여야 합니다.") LocalDate expireAt
) {
}
