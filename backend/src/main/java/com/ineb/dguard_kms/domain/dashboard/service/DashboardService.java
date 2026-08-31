package com.ineb.dguard_kms.domain.dashboard.service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.domain.dashboard.dto.DashboardSummaryResponse;
import com.ineb.dguard_kms.domain.dashboard.dto.DashboardTrendPointResponse;
import com.ineb.dguard_kms.domain.dashboard.dto.DashboardTrendResponse;
import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyStatus;
import com.ineb.dguard_kms.domain.key.entity.KeyUsageLog;
import com.ineb.dguard_kms.domain.key.repository.CryptoKeyRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyUsageLogRepository;
import com.ineb.dguard_kms.domain.key.service.CryptoKeyService;
import com.ineb.dguard_kms.domain.key.service.KeyOperationException;

@Service
public class DashboardService {

    private final CryptoKeyRepository keyRepository;
    private final KeyUsageLogRepository usageRepository;
    private final CryptoKeyService keyService;

    public DashboardService(
            CryptoKeyRepository keyRepository,
            KeyUsageLogRepository usageRepository,
            CryptoKeyService keyService
    ) {
        this.keyRepository = keyRepository;
        this.usageRepository = usageRepository;
        this.keyService = keyService;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary() {
        List<CryptoKey> keys = keyRepository.findAll();
        List<KeyUsageLog> operations = usageRepository.findAll();
        long success = operations.stream().filter(KeyUsageLog::isSuccess).count();
        return new DashboardSummaryResponse(
                keys.size(),
                keys.stream().filter(key -> key.getStatus().canEncrypt()).count(),
                keys.stream().filter(key -> key.getStatus().canDecrypt()).count(),
                keys.stream().filter(key -> key.getStatus() == KeyStatus.DESTROYED).count(),
                keyService.verifyAllIntegrity().invalidKeys(),
                operations.size(),
                success,
                operations.size() - success
        );
    }

    @Transactional(readOnly = true)
    public DashboardTrendResponse usageTrend(LocalDate requestedFrom, LocalDate requestedTo, String requestedInterval) {
        LocalDate to = requestedTo == null ? LocalDate.now(ZoneOffset.UTC) : requestedTo;
        LocalDate from = requestedFrom == null ? to.minusDays(29) : requestedFrom;
        String interval = requestedInterval == null ? "DAY" : requestedInterval.trim().toUpperCase(Locale.ROOT);
        if (!"DAY".equals(interval) && !"MONTH".equals(interval)) {
            throw badRequest("interval은 DAY 또는 MONTH여야 합니다.", "INVALID_CHART_INTERVAL");
        }
        if (from.isAfter(to) || ChronoUnit.DAYS.between(from, to) > 3660) {
            throw badRequest("조회 기간은 시작일이 종료일보다 빠른 10년 이내여야 합니다.", "INVALID_CHART_RANGE");
        }

        Map<LocalDate, MutablePoint> points = initializePoints(from, to, interval);
        keyRepository.findAll().stream()
                .filter(key -> within(key.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate(), from, to))
                .forEach(key -> points.get(bucket(key.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate(), interval)).keys++);
        usageRepository.findAll().stream()
                .filter(log -> within(log.getUsedAt().atZone(ZoneOffset.UTC).toLocalDate(), from, to))
                .forEach(log -> {
                    MutablePoint point = points.get(bucket(log.getUsedAt().atZone(ZoneOffset.UTC).toLocalDate(), interval));
                    if ("ENCRYPT".equals(log.getOperation())) point.encryptions++;
                    if ("DECRYPT".equals(log.getOperation())) point.decryptions++;
                    point.total++;
                });

        List<DashboardTrendPointResponse> responsePoints = points.entrySet().stream()
                .map(entry -> new DashboardTrendPointResponse(
                        entry.getKey(), entry.getValue().keys, entry.getValue().encryptions,
                        entry.getValue().decryptions, entry.getValue().total
                ))
                .toList();
        return new DashboardTrendResponse(from, to, interval, responsePoints);
    }

    private Map<LocalDate, MutablePoint> initializePoints(LocalDate from, LocalDate to, String interval) {
        Map<LocalDate, MutablePoint> points = new LinkedHashMap<>();
        LocalDate current = bucket(from, interval);
        LocalDate last = bucket(to, interval);
        while (!current.isAfter(last)) {
            points.put(current, new MutablePoint());
            current = "MONTH".equals(interval) ? current.plusMonths(1) : current.plusDays(1);
        }
        return points;
    }

    private LocalDate bucket(LocalDate date, String interval) {
        return "MONTH".equals(interval) ? date.with(TemporalAdjusters.firstDayOfMonth()) : date;
    }

    private boolean within(LocalDate date, LocalDate from, LocalDate to) {
        return !date.isBefore(from) && !date.isAfter(to);
    }

    private KeyOperationException badRequest(String message, String code) {
        return new KeyOperationException(HttpStatus.BAD_REQUEST, message, code);
    }

    private static final class MutablePoint {
        private long keys;
        private long encryptions;
        private long decryptions;
        private long total;
    }
}
