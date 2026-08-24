package com.ineb.dguard_kms.domain.key.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 메타데이터 수정 요청")
public record KeyUpdateRequest(
        @Schema(description = "수정할 키 이름", example = "payment-encryption-key-v2")
        @NotBlank @Size(max = 120) String keyName,
        @Schema(description = "수정할 키 사용 목적", example = "PAYMENT_ENCRYPTION")
        @NotBlank @Size(max = 50) String purpose,
        @Schema(description = "수정할 만료일(yyyy-MM-dd)", example = "2027-12-31")
        @NotNull @Future LocalDate expireAt
) {
}
