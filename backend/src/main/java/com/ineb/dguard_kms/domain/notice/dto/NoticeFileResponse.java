package com.ineb.dguard_kms.domain.notice.dto;

import java.util.UUID;

import com.ineb.dguard_kms.domain.notice.entity.NoticeFile;

public record NoticeFileResponse(UUID fileUid, String originalName, long size, int encVer) {
    public static NoticeFileResponse from(NoticeFile file) {
        return new NoticeFileResponse(file.getFileUid(), file.getOriginalName(), file.getSize(), file.getEncryptionVersion());
    }
}
