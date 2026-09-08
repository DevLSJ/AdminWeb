package com.ineb.dguard_kms.domain.dashboard.dto;

import java.time.LocalDate;
import java.util.UUID;

public record DashboardExpiringKeyResponse(UUID keyUid, String keyName, String algorithm, LocalDate expireAt) {}
