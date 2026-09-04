package com.ineb.dguard_kms.domain.audit.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

import com.ineb.dguard_kms.common.PageResponse;
import com.ineb.dguard_kms.crypto.IntegrityService;
import com.ineb.dguard_kms.domain.audit.dto.AuditLogResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditEntryVerificationResponse;
import com.ineb.dguard_kms.domain.audit.dto.AuditVerificationResponse;
import com.ineb.dguard_kms.domain.audit.entity.AuditChainHead;
import com.ineb.dguard_kms.domain.audit.entity.AuditLog;
import com.ineb.dguard_kms.domain.audit.repository.AuditChainHeadRepository;
import com.ineb.dguard_kms.domain.audit.repository.AuditLogRepository;

@Service
public class AuditLogService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final AuditLogRepository repository;
    private final AuditChainHeadRepository chainHeadRepository;
    private final IntegrityService integrityService;

    public AuditLogService(
            AuditLogRepository repository,
            AuditChainHeadRepository chainHeadRepository,
            IntegrityService integrityService
    ) {
        this.repository = repository;
        this.chainHeadRepository = chainHeadRepository;
        this.integrityService = integrityService;
    }

    @Transactional
    public void append(String actor, String action, String targetType, String targetId, String detail) {
        AuditChainHead chainHead = chainHeadRepository.findForUpdate((short) 1)
                .orElseGet(() -> chainHeadRepository.saveAndFlush(new AuditChainHead((short) 1)));
        String previousHash = chainHead.getCurrentHash();
        UUID logUid = UUID.randomUUID();
        // PostgreSQL timestamptz stores microseconds. Hash the same precision that is persisted.
        Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String normalizedDetail = detail.length() > 1000 ? detail.substring(0, 1000) : detail;
        String rowHash = calculateHash(
                logUid, actor, action, targetType, targetId, normalizedDetail, previousHash, createdAt
        );
        repository.save(new AuditLog(
                logUid, actor, action, targetType, targetId, normalizedDetail, previousHash, rowHash, createdAt
        ));
        chainHead.advance(rowHash);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> search(
            LocalDate from,
            LocalDate to,
            String actor,
            String action,
            int page,
            int size
    ) {
        Page<AuditLogResponse> result = repository.findAll(
                specification(from, to, actor, action),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).map(log -> AuditLogResponse.from(log, verifyRow(log)));
        return PageResponse.from(result);
    }

    @Transactional
    public byte[] exportCsv(LocalDate from, LocalDate to, String actorFilter, String action, String actor) {
        List<AuditLog> logs = repository.findAll(
                specification(from, to, actorFilter, action),
                Sort.by(Sort.Direction.ASC, "createdAt")
        );
        if (logs.size() > 10_000) {
            throw new IllegalArgumentException("감사 로그 CSV는 한 번에 10,000건까지 내려받을 수 있습니다.");
        }
        StringBuilder csv = new StringBuilder("\uFEFFlogUid,actor,action,targetType,targetId,detail,createdAt,previousHash,rowHash,rowValid\r\n");
        for (AuditLog log : logs) {
            csv.append(csv(log.getLogUid()))
                    .append(',').append(csv(log.getActor()))
                    .append(',').append(csv(log.getAction()))
                    .append(',').append(csv(log.getTargetType()))
                    .append(',').append(csv(log.getTargetId()))
                    .append(',').append(csv(log.getDetail()))
                    .append(',').append(csv(log.getCreatedAt()))
                    .append(',').append(csv(log.getPreviousHash()))
                    .append(',').append(csv(log.getRowHash()))
                    .append(',').append(verifyRow(log))
                    .append("\r\n");
        }
        append(actor, "AUDIT_EXPORT", "AUDIT_LOG", "CSV", "감사 로그 CSV 내보내기: " + logs.size() + "건");
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public AuditVerificationResponse verifyChain() {
        return verifyChain(null, null);
    }

    @Transactional(readOnly = true)
    public AuditVerificationResponse verifyChain(Instant from, Instant to) {
        boolean ranged = from != null || to != null;
        if (ranged && (from == null || to == null)) {
            throw new IllegalArgumentException("시작일시와 종료일시를 모두 입력해야 합니다.");
        }
        if (ranged && !from.isBefore(to)) {
            throw new IllegalArgumentException("종료일시는 시작일시보다 이후여야 합니다.");
        }
        if (ranged && from.plus(366, ChronoUnit.DAYS).isBefore(to)) {
            throw new IllegalArgumentException("해시 체인 검증 기간은 최대 366일까지 선택할 수 있습니다.");
        }

        List<AuditLog> logs = ranged
                ? repository.findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByIdAsc(from, to)
                : repository.findAllByOrderByIdAsc();
        List<UUID> invalid = new ArrayList<>();
        AuditLog previous = logs.isEmpty()
                ? ranged
                        ? repository.findTopByCreatedAtLessThanOrderByCreatedAtDescIdDesc(from).orElse(null)
                        : null
                : repository.findTopByIdLessThanOrderByIdDesc(logs.get(0).getId()).orElse(null);
        String expectedPreviousHash = previous == null ? null : previous.getRowHash();
        for (AuditLog log : logs) {
            boolean previousValid = java.util.Objects.equals(expectedPreviousHash, log.getPreviousHash());
            boolean rowValid = verifyRow(log);
            if (!previousValid || !rowValid) invalid.add(log.getLogUid());
            expectedPreviousHash = log.getRowHash();
        }

        AuditLog last = logs.isEmpty() ? previous : logs.get(logs.size() - 1);
        AuditLog next = logs.isEmpty()
                ? ranged
                        ? repository.findTopByCreatedAtGreaterThanOrderByCreatedAtAscIdAsc(to).orElse(null)
                        : null
                : repository.findTopByIdGreaterThanOrderByIdAsc(last.getId()).orElse(null);
        String lastHash = last == null ? null : last.getRowHash();
        boolean headValid;
        if (next != null) {
            // 기간 안에 행이 없어도 직전·직후 연결을 비교해 통째로 삭제된 구간을 탐지한다.
            headValid = java.util.Objects.equals(lastHash, next.getPreviousHash());
        } else {
            String storedHead = chainHeadRepository.findById((short) 1)
                    .map(AuditChainHead::getCurrentHash)
                    .orElse(null);
            headValid = java.util.Objects.equals(lastHash, storedHead);
        }
        if (!headValid) {
            UUID boundaryUid = next != null ? next.getLogUid() : last == null ? null : last.getLogUid();
            if (boundaryUid != null && !invalid.contains(boundaryUid)) invalid.add(boundaryUid);
        }
        return new AuditVerificationResponse(
                invalid.isEmpty() && headValid,
                logs.size(),
                List.copyOf(invalid),
                headValid,
                ranged ? from : null,
                ranged ? to : null,
                Instant.now().truncatedTo(ChronoUnit.MILLIS)
        );
    }

    @Transactional(readOnly = true)
    public AuditEntryVerificationResponse verifyEntry(UUID logUid) {
        AuditLog log = repository.findByLogUid(logUid)
                .orElseThrow(() -> new IllegalArgumentException("감사 로그를 찾을 수 없습니다."));
        AuditLog previous = repository.findTopByIdLessThanOrderByIdDesc(log.getId()).orElse(null);
        AuditLog next = repository.findTopByIdGreaterThanOrderByIdAsc(log.getId()).orElse(null);

        boolean rowHashValid = verifyRow(log);
        boolean previousLinkValid = java.util.Objects.equals(
                previous == null ? null : previous.getRowHash(), log.getPreviousHash()
        );
        boolean nextLinkValid = next == null || java.util.Objects.equals(log.getRowHash(), next.getPreviousHash());
        String storedHead = chainHeadRepository.findById((short) 1)
                .map(AuditChainHead::getCurrentHash).orElse(null);
        boolean chainHeadValid = next != null || java.util.Objects.equals(log.getRowHash(), storedHead);

        return new AuditEntryVerificationResponse(
                logUid,
                rowHashValid && previousLinkValid && nextLinkValid && chainHeadValid,
                rowHashValid,
                previousLinkValid,
                nextLinkValid,
                chainHeadValid,
                previous == null ? null : previous.getLogUid(),
                next == null ? null : next.getLogUid(),
                Instant.now().truncatedTo(ChronoUnit.MILLIS)
        );
    }

    private Specification<AuditLog> specification(
            LocalDate from,
            LocalDate to,
            String actor,
            String action
    ) {
        Instant fromTime = from == null ? null : from.atStartOfDay(KST).toInstant();
        Instant toTime = to == null ? null : to.plusDays(1).atStartOfDay(KST).toInstant();
        String actorFilter = actor == null || actor.isBlank() ? null : actor.trim().toLowerCase();
        String actionFilter = action == null || action.isBlank() || "ALL".equalsIgnoreCase(action)
                ? null
                : action.trim().toUpperCase();
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (fromTime != null) predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), fromTime));
            if (toTime != null) predicates.add(criteriaBuilder.lessThan(root.get("createdAt"), toTime));
            if (actorFilter != null) {
                predicates.add(criteriaBuilder.like(criteriaBuilder.lower(root.get("actor")), "%" + actorFilter + "%"));
            }
            if (actionFilter != null) predicates.add(criteriaBuilder.equal(root.get("action"), actionFilter));
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private String csv(Object value) {
        String text = value == null ? "" : value.toString();
        if (!text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) text = "'" + text;
        return '"' + text.replace("\"", "\"\"") + '"';
    }

    private boolean verifyRow(AuditLog log) {
        return integrityService.verify(
                log.getRowHash(),
                values(
                        log.getLogUid(), log.getActor(), log.getAction(), log.getTargetType(), log.getTargetId(),
                        log.getDetail(), log.getPreviousHash(), log.getCreatedAt()
                )
        );
    }

    private String calculateHash(
            UUID logUid,
            String actor,
            String action,
            String targetType,
            String targetId,
            String detail,
            String previousHash,
            Instant createdAt
    ) {
        return integrityService.sign(values(logUid, actor, action, targetType, targetId, detail, previousHash, createdAt));
    }

    private String[] values(
            UUID logUid,
            String actor,
            String action,
            String targetType,
            String targetId,
            String detail,
            String previousHash,
            Instant createdAt
    ) {
        return new String[] {
                logUid.toString(), actor, action, targetType, targetId, detail, previousHash, createdAt.toString()
        };
    }
}
