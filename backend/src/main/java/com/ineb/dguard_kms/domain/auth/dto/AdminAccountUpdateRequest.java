package com.ineb.dguard_kms.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminAccountUpdateRequest(
        @NotBlank @Size(max = 64) String name,
        @Pattern(regexp = "S\\.ADMIN|ADMIN|CLIENT") String role
) {}
