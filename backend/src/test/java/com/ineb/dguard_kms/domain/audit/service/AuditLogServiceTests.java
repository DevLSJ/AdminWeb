package com.ineb.dguard_kms.domain.audit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.ineb.dguard_kms.crypto.IntegrityService;
import com.ineb.dguard_kms.domain.audit.entity.AuditLog;
import com.ineb.dguard_kms.domain.audit.repository.AuditChainHeadRepository;
import com.ineb.dguard_kms.domain.audit.repository.AuditLogRepository;

class AuditLogServiceTests {

    @Test
    void detectsADeletedAuditSegmentWhenTheSelectedRangeIsEmpty() {
        AuditLogRepository logs = mock(AuditLogRepository.class);
        AuditChainHeadRepository chainHead = mock(AuditChainHeadRepository.class);
        IntegrityService integrity = mock(IntegrityService.class);
        AuditLogService service = new AuditLogService(logs, chainHead, integrity);
        Instant from = Instant.parse("2026-09-04T00:00:00Z");
        Instant to = Instant.parse("2026-09-04T01:00:00Z");
        AuditLog previous = log("PREVIOUS_HASH", null, from.minusSeconds(1));
        AuditLog next = log("NEXT_HASH", "DELETED_ROW_HASH", to.plusSeconds(1));

        when(logs.findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByIdAsc(from, to))
                .thenReturn(List.of());
        when(logs.findTopByCreatedAtLessThanOrderByCreatedAtDescIdDesc(from))
                .thenReturn(Optional.of(previous));
        when(logs.findTopByCreatedAtGreaterThanOrderByCreatedAtAscIdAsc(to))
                .thenReturn(Optional.of(next));

        var result = service.verifyChain(from, to);

        assertThat(result.valid()).isFalse();
        assertThat(result.checkedCount()).isZero();
        assertThat(result.headValid()).isFalse();
        assertThat(result.invalidLogUids()).containsExactly(next.getLogUid());
    }

    private AuditLog log(String rowHash, String previousHash, Instant createdAt) {
        return new AuditLog(
                UUID.randomUUID(), "admin", "TEST", "TEST", "target", "detail",
                previousHash, rowHash, createdAt
        );
    }
}
