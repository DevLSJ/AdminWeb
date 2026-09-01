package com.ineb.dguard_kms.domain.audit.dto;

import java.time.Instant;
import java.util.UUID;

public record AuditEntryVerificationResponse(
        UUID logUid,
        boolean valid,
        boolean rowHashValid,
        boolean previousLinkValid,
        boolean nextLinkValid,
        boolean chainHeadValid,
        UUID previousLogUid,
        UUID nextLogUid,
        Instant verifiedAt
) {
}
