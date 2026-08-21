package com.ineb.dguard_kms.domain.audit.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ineb.dguard_kms.domain.audit.entity.AuditChainHead;

import jakarta.persistence.LockModeType;

public interface AuditChainHeadRepository extends JpaRepository<AuditChainHead, Short> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select head from AuditChainHead head where head.id = :id")
    Optional<AuditChainHead> findForUpdate(@Param("id") short id);
}
