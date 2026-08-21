package com.ineb.dguard_kms.domain.audit.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ineb.dguard_kms.domain.audit.entity.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Optional<AuditLog> findTopByOrderByIdDesc();

    List<AuditLog> findAllByOrderByIdAsc();

    @Query("""
            select log from AuditLog log
            where (:fromTime is null or log.createdAt >= :fromTime)
              and (:toTime is null or log.createdAt < :toTime)
              and (:actor is null or lower(log.actor) like lower(concat('%', :actor, '%')))
              and (:action is null or log.action = :action)
            """)
    Page<AuditLog> search(
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime,
            @Param("actor") String actor,
            @Param("action") String action,
            Pageable pageable
    );
}
