package com.ineb.dguard_kms.domain.notice.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ineb.dguard_kms.domain.notice.entity.Notice;

import jakarta.persistence.LockModeType;

public interface NoticeRepository extends JpaRepository<Notice, Long>, JpaSpecificationExecutor<Notice> {
    Optional<Notice> findByNoticeUid(UUID noticeUid);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Notice> findForUpdateByNoticeUid(UUID noticeUid);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select notice from Notice notice where notice.noticeUid in :noticeUids order by notice.id")
    java.util.List<Notice> findAllForUpdateByNoticeUidIn(@Param("noticeUids") java.util.Collection<UUID> noticeUids);
}
