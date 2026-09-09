package com.ineb.dguard_kms.domain.notice.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.ineb.dguard_kms.domain.notice.entity.Notice;
import com.ineb.dguard_kms.domain.notice.entity.NoticeFile;

public record NoticeResponse(
        @io.swagger.v3.oas.annotations.media.Schema(description = "생성 순서에 따른 목록 표시 번호. API 식별자는 UUID를 사용합니다.")
        long displayNumber,
        UUID noticeUid,
        String title,
        String content,
        String category,
        String exposeYn,
        long viewCount,
        String createdBy,
        String authorRole,
        Instant createdAt,
        Instant updatedAt,
        List<NoticeFileResponse> files
) {
    public static NoticeResponse from(Notice notice, List<NoticeFile> files, String authorRole) {
        return new NoticeResponse(
                notice.getId(),
                notice.getNoticeUid(), notice.getTitle(), notice.getContent(), notice.getCategory(), notice.getExposeYn(),
                notice.getViewCount(), notice.getCreatedBy(), authorRole, notice.getCreatedAt(), notice.getUpdatedAt(),
                files.stream().map(NoticeFileResponse::from).toList()
        );
    }
}
