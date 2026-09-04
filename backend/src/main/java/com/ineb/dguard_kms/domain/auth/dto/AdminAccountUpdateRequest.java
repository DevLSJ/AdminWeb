package com.ineb.dguard_kms.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminAccountUpdateRequest(
        @NotBlank @Size(max = 64) String name,
        @Pattern(regexp = "ADMIN|CLIENT") String role,
        @Pattern(regexp = "[0-9+()\\-\\s]{9,20}") String phone,
        @Email @Size(max = 254) String email
) {}
