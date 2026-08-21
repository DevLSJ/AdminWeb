package com.ineb.dguard_kms.domain.audit.dto;

import java.util.List;
import java.util.UUID;

public record AuditVerificationResponse(
        boolean valid,
        long checkedCount,
        List<UUID> invalidLogUids
) {
}
