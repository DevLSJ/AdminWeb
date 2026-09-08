package com.ineb.dguard_kms.domain.dashboard.service;

import java.time.LocalDate;
import java.time.ZoneId;
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

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final com.ineb.dguard_kms.domain.user.repository.AppUserRepository userRepository;
    private final com.ineb.dguard_kms.domain.notice.repository.NoticeRepository noticeRepository;
    private final com.ineb.dguard_kms.domain.user.service.AppUserService userService;
    private final com.ineb.dguard_kms.domain.audit.service.AuditLogService auditService;
    private final CryptoKeyRepository keyRepository;
    private final KeyUsageLogRepository usageRepository;
    private final CryptoKeyService keyService;

    public DashboardService(
            CryptoKeyRepository keyRepository,
            KeyUsageLogRepository usageRepository,
            CryptoKeyService keyService,
            com.ineb.dguard_kms.domain.user.repository.AppUserRepository userRepository,
            com.ineb.dguard_kms.domain.notice.repository.NoticeRepository noticeRepository,
            com.ineb.dguard_kms.domain.user.service.AppUserService userService,
            com.ineb.dguard_kms.domain.audit.service.AuditLogService auditService
    ) {
        this.userRepository = userRepository;
        this.noticeRepository = noticeRepository;
        this.userService = userService;
        this.auditService = auditService;
        this.keyRepository = keyRepository;
        this.usageRepository = usageRepository;
        this.keyService = keyService;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse summary() {
        List<CryptoKey> keys = keyRepository.findAll();
        long operations = usageRepository.count();
        long success = usageRepository.countByResult("SUCCESS");
        long keyViolations = keyService.verifyAllIntegrity().invalidKeys();
        long userViolations = userService.countIntegrityViolations();
        var audit = auditService.verifyChain();
        long auditViolations = audit.invalidLogUids().size();
        if (!audit.valid() && auditViolations == 0) auditViolations = 1;
        LocalDate today = LocalDate.now(KST);
        return new DashboardSummaryResponse(
                keys.size(),
                keys.stream().filter(key -> key.getStatus().canEncrypt()).count(),
                keys.stream().filter(key -> key.getStatus().canDecrypt()).count(),
                keys.stream().filter(key -> key.getStatus() == KeyStatus.DESTROYED).count(),
                keyViolations + userViolations + auditViolations,
                operations,
                success,
                userRepository.count(),
                noticeRepository.count(),
                keyRepository.countByStatusAndExpireAtBetween(KeyStatus.ACTIVE, expiryDate(today), expiryDate(today.plusDays(30))),
                keyViolations,
                userViolations,
                auditViolations,
                operations - success
        );
    }

    @Transactional(readOnly = true)
    public List<com.ineb.dguard_kms.domain.dashboard.dto.DashboardExpiringKeyResponse> expiring(int days) {
        if (days < 1 || days > 365) throw badRequest("days는 1~365여야 합니다.", "INVALID_EXPIRING_DAYS");
        LocalDate today = LocalDate.now(KST);
        return keyRepository.findAllByStatusAndExpireAtBetweenOrderByExpireAtAscKeyUidAsc(KeyStatus.ACTIVE, expiryDate(today), expiryDate(today.plusDays(days)))
                .stream().map(key -> new com.ineb.dguard_kms.domain.dashboard.dto.DashboardExpiringKeyResponse(
                        key.getKeyUid(), key.getKeyName(), key.getAlgorithm(), key.getExpireAt())).toList();
    }

    @Transactional(readOnly = true)
    public DashboardTrendResponse usageTrend(LocalDate requestedFrom, LocalDate requestedTo, String requestedInterval) {
        LocalDate to = requestedTo == null ? LocalDate.now(KST) : requestedTo;
        LocalDate from = requestedFrom == null ? to.minusDays(29) : requestedFrom;
        String interval = requestedInterval == null ? "DAY" : requestedInterval.trim().toUpperCase(Locale.ROOT);
        if (!"DAY".equals(interval) && !"MONTH".equals(interval)) {
            throw badRequest("interval은 DAY 또는 MONTH여야 합니다.", "INVALID_CHART_INTERVAL");
        }
        if (from.isAfter(to) || ChronoUnit.DAYS.between(from, to) > 3660) {
            throw badRequest("조회 기간은 시작일이 종료일보다 빠른 10년 이내여야 합니다.", "INVALID_CHART_RANGE");
        }

        Map<LocalDate, MutablePoint> points = initializePoints(from, to, interval);
        keyRepository.findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from.atStartOfDay(KST).toInstant(), to.plusDays(1).atStartOfDay(KST).toInstant()).stream()
                .filter(key -> within(key.getCreatedAt().atZone(KST).toLocalDate(), from, to))
                .forEach(key -> points.get(bucket(key.getCreatedAt().atZone(KST).toLocalDate(), interval)).keys++);
        usageRepository.findAllByUsedAtGreaterThanEqualAndUsedAtLessThan(from.atStartOfDay(KST).toInstant(), to.plusDays(1).atStartOfDay(KST).toInstant()).stream()
                .filter(log -> within(log.getUsedAt().atZone(KST).toLocalDate(), from, to))
                .forEach(log -> {
                    MutablePoint point = points.get(bucket(log.getUsedAt().atZone(KST).toLocalDate(), interval));
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

    // CryptoKey stores a date as UTC midnight; choose today's date in KST first.
    private java.time.Instant expiryDate(LocalDate date) {
        return date.atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
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
