package com.ineb.dguard_kms.domain.key.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "새 암호키 생성 요청")
public record KeyCreateRequest(
        @Schema(description = "중복되지 않는 키 이름", example = "payment-encryption-key")
        @NotBlank(message = "키 이름은 필수입니다.") String keyName,
        @Schema(description = "암호 알고리즘", example = "AES")
        @NotBlank(message = "알고리즘은 필수입니다.") String algorithm,
        @Schema(description = "암호 모드. AES는 GCM/CBC, RSA는 OAEP_SHA256", example = "GCM")
        String mode,
        @Schema(description = "키 길이(비트). AES 128/192/256, RSA 2048/3072/4096", example = "256")
        @Positive(message = "키 길이는 양수여야 합니다.") int keySize,
        @Schema(description = "키 사용 목적", example = "PAYMENT_ENCRYPTION")
        @NotBlank(message = "키 용도는 필수입니다.") String purpose,
        @Schema(description = "키 만료일(yyyy-MM-dd)", example = "2027-12-31")
        @Future(message = "만료일은 미래 날짜여야 합니다.") LocalDate expireAt,
        @Schema(description = "자동 갱신 주기(일). KMIP/Naver/Kakao 호환 일 단위", example = "30")
        @Positive(message = "자동 갱신 주기는 1일 이상이어야 합니다.") Integer autoRotationDays
) {
}
