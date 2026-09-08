package com.ineb.dguard_kms.domain.audit.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** recordedAt is the affected event time; detectedAt is verification time, not tampering time. */
public record AuditViolationResponse(UUID logUid, String action, String actor, Instant recordedAt,
                                     Instant detectedAt, List<String> violations) { }
