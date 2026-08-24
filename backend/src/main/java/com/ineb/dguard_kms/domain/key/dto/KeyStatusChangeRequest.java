package com.ineb.dguard_kms.domain.key.dto;

import com.ineb.dguard_kms.domain.key.entity.KeyStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "키 상태 변경 요청")
public record KeyStatusChangeRequest(
        @Schema(
                description = "변경할 키 상태. CREATED, ACTIVE, INACTIVE, EXPIRED, DISTRIBUTED, DEPLOY_FAILED, DESTROYED",
                example = "INACTIVE"
        )
        @NotNull(message = "변경 상태는 필수입니다.") KeyStatus toStatus,
        @Schema(description = "상태 변경 사유", example = "운영 종료")
        @NotBlank(message = "상태 변경 사유는 필수입니다.") String reason
) {
}
