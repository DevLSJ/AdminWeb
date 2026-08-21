package com.ineb.dguard_kms.domain.key.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record KeyUpdateRequest(
        @NotBlank @Size(max = 120) String keyName,
        @NotBlank @Size(max = 50) String purpose,
        @NotNull @Future LocalDate expireAt
) {
}
