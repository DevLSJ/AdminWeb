package com.ineb.dguard_kms.domain.audit.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
        Instant createdAt = Instant.now();
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
        Instant fromTime = from == null ? null : from.atStartOfDay(KST).toInstant();
        Instant toTime = to == null ? null : to.plusDays(1).atStartOfDay(KST).toInstant();
        String actorFilter = actor == null || actor.isBlank() ? null : actor.trim();
        String actionFilter = action == null || action.isBlank() || "ALL".equals(action) ? null : action;
        Page<AuditLogResponse> result = repository.search(
                fromTime,
                toTime,
                actorFilter,
                actionFilter,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).map(log -> AuditLogResponse.from(log, verifyRow(log)));
        return PageResponse.from(result);
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
        return new AuditVerificationResponse(invalid.isEmpty() && headValid, logs.size(), List.copyOf(invalid));
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
