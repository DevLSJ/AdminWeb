package com.ineb.dguard_kms.domain.audit.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
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
        Instant from = Instant.parse("2026-09-03T15:00:00Z");
        Instant to = Instant.parse("2026-09-04T15:00:00Z");
        AuditLog previous = log("PREVIOUS_HASH", null, from.minusSeconds(1));
        AuditLog next = log("NEXT_HASH", "DELETED_ROW_HASH", to);

        when(logs.findAllByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByIdAsc(from, to))
                .thenReturn(List.of());
        when(logs.findTopByCreatedAtLessThanOrderByCreatedAtDescIdDesc(from))
                .thenReturn(Optional.of(previous));
        when(logs.findTopByCreatedAtGreaterThanEqualOrderByCreatedAtAscIdAsc(to))
                .thenReturn(Optional.of(next));

        var result = service.verifyChain(LocalDate.parse("2026-09-04"), LocalDate.parse("2026-09-04"));

        assertThat(result.rangeFrom()).isEqualTo(from);
        assertThat(result.rangeTo()).isEqualTo(to);
        assertThat(result.valid()).isFalse();
        assertThat(result.checkedCount()).isZero();
        assertThat(result.headValid()).isFalse();
        assertThat(result.invalidLogUids()).containsExactly(next.getLogUid());
    }

    @Test
    void validatesInclusiveCalendarDayLimitsAndMissingDates() {
        AuditLogService service = new AuditLogService(mock(AuditLogRepository.class),
                mock(AuditChainHeadRepository.class), mock(IntegrityService.class));
        LocalDate start = LocalDate.of(2026, 1, 1);

        assertThat(service.verifyChain(start, start).valid()).isTrue();
        assertThat(service.verifyChain(start, start.plusDays(365)).valid()).isTrue();
        assertThatIllegalArgumentException().isThrownBy(() -> service.verifyChain(start, start.plusDays(366)));
        assertThatIllegalArgumentException().isThrownBy(() -> service.verifyChain(start, start.minusDays(1)));
        assertThatIllegalArgumentException().isThrownBy(() -> service.verifyChain(start, null));
        assertThatIllegalArgumentException().isThrownBy(() -> service.verifyChain(null, start));
    }

    private AuditLog log(String rowHash, String previousHash, Instant createdAt) {
        return new AuditLog(
                UUID.randomUUID(), "admin", "TEST", "TEST", "target", "detail",
                previousHash, rowHash, createdAt
        );
    }
}
