package com.ineb.dguard_kms.domain.dashboard.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ineb.dguard_kms.common.ApiResponse;
import com.ineb.dguard_kms.domain.dashboard.dto.DashboardSummaryResponse;
import com.ineb.dguard_kms.domain.dashboard.dto.DashboardTrendResponse;
import com.ineb.dguard_kms.domain.dashboard.service.DashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/dashboard")
@Tag(name = "Dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    @Operation(summary = "대시보드 요약")
    public ApiResponse<DashboardSummaryResponse> summary() {
        return ApiResponse.success(dashboardService.summary(), "대시보드 요약 조회에 성공했습니다.");
    }

    @GetMapping({"/usage-trend", "/trends"})
    @Operation(summary = "키 생성·사용 추이", description = "일별 또는 월별 라인 차트용 0 포함 시계열을 반환합니다.")
    public ApiResponse<DashboardTrendResponse> usageTrend(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "DAY") String interval
    ) {
        return ApiResponse.success(
                dashboardService.usageTrend(from, to, interval), "키 생성·사용 추이 조회에 성공했습니다."
        );
    }
}
