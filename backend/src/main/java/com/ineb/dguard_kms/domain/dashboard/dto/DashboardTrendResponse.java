package com.ineb.dguard_kms.domain.dashboard.dto;

import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "대시보드 라인 차트 시계열")
public record DashboardTrendResponse(
        LocalDate from,
        LocalDate to,
        String interval,
        List<DashboardTrendPointResponse> points
) { }
