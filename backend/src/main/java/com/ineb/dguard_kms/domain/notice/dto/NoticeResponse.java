package com.ineb.dguard_kms.domain.notice.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.ineb.dguard_kms.domain.notice.entity.Notice;
import com.ineb.dguard_kms.domain.notice.entity.NoticeFile;

public record NoticeResponse(
        UUID noticeUid,
        String title,
        String content,
        String exposeYn,
        long viewCount,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        List<NoticeFileResponse> files
) {
    public static NoticeResponse from(Notice notice, List<NoticeFile> files) {
        return new NoticeResponse(
                notice.getNoticeUid(), notice.getTitle(), notice.getContent(), notice.getExposeYn(),
                notice.getViewCount(), notice.getCreatedBy(), notice.getCreatedAt(), notice.getUpdatedAt(),
                files.stream().map(NoticeFileResponse::from).toList()
        );
    }
}
