package com.ineb.dguard_kms.domain.audit.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.ineb.dguard_kms.domain.audit.entity.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    Optional<AuditLog> findTopByOrderByIdDesc();

    Optional<AuditLog> findByLogUid(java.util.UUID logUid);

    Optional<AuditLog> findTopByIdLessThanOrderByIdDesc(Long id);

    Optional<AuditLog> findTopByIdGreaterThanOrderByIdAsc(Long id);

    List<AuditLog> findAllByOrderByIdAsc();

}
