package com.ineb.dguard_kms.common;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "모든 API의 공통 응답 형식")
public record ApiResponse<T>(
        @Schema(description = "요청 처리 성공 여부", example = "true")
        boolean success,
        @Schema(description = "API별 응답 데이터. 실패 시 null")
        T data,
        @Schema(description = "사용자에게 표시할 처리 결과 메시지", example = "조회에 성공했습니다.")
        String message,
        @Schema(description = "실패한 경우의 애플리케이션 오류 코드", example = "UNAUTHORIZED", nullable = true)
        String errorCode
) {
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(true, data, message, null);
    }

    public static <T> ApiResponse<T> failure(String message, String errorCode) {
        return new ApiResponse<>(false, null, message, errorCode);
    }
}
