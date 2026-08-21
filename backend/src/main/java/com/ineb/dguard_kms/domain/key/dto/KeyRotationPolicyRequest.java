package com.ineb.dguard_kms.domain.key.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record KeyRotationPolicyRequest(
        @Min(1) @Max(3650) Integer days
) {
}
