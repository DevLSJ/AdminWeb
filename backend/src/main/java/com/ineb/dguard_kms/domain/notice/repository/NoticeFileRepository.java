package com.ineb.dguard_kms.domain.notice.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.notice.entity.NoticeFile;

public interface NoticeFileRepository extends JpaRepository<NoticeFile, Long> {
    List<NoticeFile> findAllByNoticeIdOrderByCreatedAtAsc(Long noticeId);
    Optional<NoticeFile> findByFileUid(UUID fileUid);
    void deleteAllByNoticeId(Long noticeId);
}
