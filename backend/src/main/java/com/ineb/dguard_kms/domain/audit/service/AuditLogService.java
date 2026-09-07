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
        StringBuilder csv = new StringBuilder("\uFEFF");
        appendCsvGuide(csv);
        csv.append("logUid,actor,action,targetType,targetId,detail,createdAt,previousHash,rowHash,rowValid\r\n");
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
    public AuditVerificationResponse verifyChain(LocalDate fromDate, LocalDate toDate) {
        boolean ranged = fromDate != null || toDate != null;
        if (ranged && (fromDate == null || toDate == null)) {
            throw new IllegalArgumentException("시작일과 종료일을 모두 입력해야 합니다.");
        }
        if (ranged && fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("종료일은 시작일과 같거나 이후여야 합니다.");
        }
        if (ranged && ChronoUnit.DAYS.between(fromDate, toDate) >= 366) {
            throw new IllegalArgumentException("해시 체인 검증 기간은 최대 366일까지 선택할 수 있습니다.");
        }
        Instant from = ranged ? fromDate.atStartOfDay(KST).toInstant() : null;
        // 종료일 전체를 포함하되 다음 날 0시는 제외한다.
        Instant to = ranged ? toDate.plusDays(1).atStartOfDay(KST).toInstant() : null;

        List<AuditLog> logs = ranged
                ? repository.findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdAsc(from, to)
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
                        ? repository.findTopByCreatedAtGreaterThanEqualOrderByCreatedAtAscIdAsc(to).orElse(null)
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

    private void appendCsvGuide(StringBuilder output) {
        // CSV에는 표준 주석 문법이 없으므로 첫 셀이 #으로 시작하는 안내 행을 사용한다.
        // 모든 안내 행도 데이터와 같은 10열로 맞춰 표 형태로 열 수 있게 한다.
        String[][] guide = {
                {"# 감사 로그 CSV 읽는 법", "", "#으로 시작하는 안내 행 다음의 logUid 헤더부터 실제 로그 데이터입니다.", ""},
                {"# 열 이름", "한글 의미", "설명", "예시"},
                {"# logUid", "로그 고유 ID", "감사 기록 한 건을 구분하는 UUID입니다. 개별 로그 검증에 사용합니다.", "9e33c0a4-8a4e-4461-afe9-c7427b6280d1"},
                {"# actor", "행위자", "작업을 수행한 계정의 로그인 ID입니다.", "admin"},
                {"# action", "수행한 행위", "기록된 작업의 코드입니다.", "LOGIN = 로그인 / LOGOUT = 로그아웃 / KEY_CREATE = 키 생성"},
                {"# targetType", "대상 유형", "작업 대상의 종류입니다.", "ADMIN_USER = 관리 계정 / KEY = 키 / AUDIT_LOG = 감사 로그"},
                {"# targetId", "대상 ID", "작업 대상의 식별자입니다. 대상 유형에 따라 로그인 ID 또는 UUID 등이 기록됩니다.", "admin"},
                {"# detail", "상세 설명", "수행한 작업을 설명하는 내용입니다.", "로그인 성공"},
                {"# createdAt", "기록 시각 (UTC)", "끝의 Z는 UTC를 뜻합니다. 한국 시간은 9시간을 더합니다.", "2026-09-07T00:35:11.112879Z = 한국 시간 2026-09-07 09:35:11.112879"},
                {"# previousHash", "이전 로그의 무결성 값", "직전 로그의 rowHash입니다. 로그 사이의 연결 검증에 사용하며 최초 로그는 비어 있습니다.", "Base64 문자열"},
                {"# rowHash", "현재 로그의 무결성 값", "이 로그의 내용과 이전 연결 값으로 계산한 HMAC입니다. 내용 변경 여부를 검사하는 데 사용합니다.", "Base64 문자열"},
                {"# rowValid", "현재 행의 검사 결과", "내보내기 시점에 저장된 HMAC과 재계산한 값을 비교한 결과입니다.", "true = 일치 / false = 불일치 (확인 필요)"},
                {"# 검증 범위 안내", "", "rowValid는 개별 행의 검사 결과이며 전체 체인이나 CSV 파일 자체의 서명 검증 결과가 아닙니다. 체인 연결은 기간 체인 검증 기능에서 확인하세요.", ""},
                {"# 데이터 시작", "", "다음 행은 데이터 열 이름이며 이후 각 행이 감사 로그 한 건입니다. 자동 처리 시 위 안내 행을 건너뛰세요.", ""},
        };
        for (String[] row : guide) {
            for (int column = 0; column < 10; column++) {
                if (column > 0) output.append(',');
                output.append(csv(column < row.length ? row[column] : ""));
            }
            output.append("\r\n");
        }
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
