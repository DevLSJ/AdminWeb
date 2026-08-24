package com.ineb.dguard_kms.domain.key.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "새 암호키 생성 요청")
public record KeyCreateRequest(
        @Schema(description = "중복되지 않는 키 이름", example = "payment-encryption-key")
        @NotBlank(message = "키 이름은 필수입니다.") String keyName,
        @Schema(description = "암호 알고리즘", example = "AES")
        @NotBlank(message = "알고리즘은 필수입니다.") String algorithm,
        @Schema(description = "키 길이(비트). 현재 AES-256만 허용", example = "256")
        @Min(value = 256, message = "키 길이는 256비트여야 합니다.")
        @Max(value = 256, message = "키 길이는 256비트여야 합니다.") int keySize,
        @Schema(description = "키 사용 목적", example = "PAYMENT_ENCRYPTION")
        @NotBlank(message = "키 용도는 필수입니다.") String purpose,
        @Schema(description = "키 만료일(yyyy-MM-dd)", example = "2027-12-31")
        @Future(message = "만료일은 미래 날짜여야 합니다.") LocalDate expireAt
) {
}
