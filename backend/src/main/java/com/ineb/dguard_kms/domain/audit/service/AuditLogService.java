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
        List<AuditLog> logs = repository.findAllByOrderByIdAsc();
        List<UUID> invalid = new ArrayList<>();
        String expectedPreviousHash = null;
        for (AuditLog log : logs) {
            boolean previousValid = java.util.Objects.equals(expectedPreviousHash, log.getPreviousHash());
            boolean rowValid = verifyRow(log);
            if (!previousValid || !rowValid) invalid.add(log.getLogUid());
            expectedPreviousHash = log.getRowHash();
        }
        String storedHead = chainHeadRepository.findById((short) 1)
                .map(AuditChainHead::getCurrentHash)
                .orElse(null);
        boolean headValid = java.util.Objects.equals(expectedPreviousHash, storedHead);
        if (!headValid && !logs.isEmpty()) {
            UUID lastUid = logs.get(logs.size() - 1).getLogUid();
            if (!invalid.contains(lastUid)) invalid.add(lastUid);
        }
        return new AuditVerificationResponse(
                invalid.isEmpty() && headValid,
                logs.size(),
                List.copyOf(invalid),
                headValid,
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
