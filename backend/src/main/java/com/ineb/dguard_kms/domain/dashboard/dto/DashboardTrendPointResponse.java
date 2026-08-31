package com.ineb.dguard_kms.domain.dashboard.dto;

import java.time.LocalDate;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "차트의 기간별 키 생성·사용 수치")
public record DashboardTrendPointResponse(
        LocalDate period,
        long keysCreated,
        long encryptions,
        long decryptions,
        long totalOperations
) { }
