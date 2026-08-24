package com.ineb.dguard_kms.common;

import java.util.List;

import org.springframework.data.domain.Page;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "페이지 단위 조회 결과")
public record PageResponse<T>(
        @Schema(description = "현재 페이지의 데이터 목록")
        List<T> content,
        @Schema(description = "0부터 시작하는 현재 페이지 번호", example = "0")
        int page,
        @Schema(description = "페이지당 데이터 수", example = "20")
        int size,
        @Schema(description = "전체 데이터 수", example = "125")
        long totalElements,
        @Schema(description = "전체 페이지 수", example = "7")
        int totalPages
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages()
        );
    }
}
