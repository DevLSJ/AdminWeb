package com.ineb.dguard_kms.domain.notice.dto;

public record NoticeFileDownload(String originalName, String contentType, byte[] content) {}
