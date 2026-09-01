package com.ineb.dguard_kms.domain.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;

public record AdminAccountStatusRequest(@NotBlank @Pattern(regexp = "ACTIVE|INACTIVE") String status) {}
