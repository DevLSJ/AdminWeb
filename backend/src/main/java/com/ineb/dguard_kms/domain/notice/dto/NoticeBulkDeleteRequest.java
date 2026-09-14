package com.ineb.dguard_kms.domain.notice.dto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NoticeBulkDeleteRequest(
        @NotEmpty @Size(max = 100) List<@NotNull UUID> noticeUids
) { }
