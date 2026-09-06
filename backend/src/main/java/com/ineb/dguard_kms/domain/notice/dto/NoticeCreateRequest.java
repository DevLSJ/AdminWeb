package com.ineb.dguard_kms.domain.notice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record NoticeCreateRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 100_000) String content,
        @Pattern(regexp = "NOTICE|GENERAL") String category,
        @Pattern(regexp = "Y|N") String exposeYn
) {}
