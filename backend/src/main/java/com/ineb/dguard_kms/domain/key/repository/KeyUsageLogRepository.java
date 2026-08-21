package com.ineb.dguard_kms.domain.key.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.key.entity.KeyUsageLog;

public interface KeyUsageLogRepository extends JpaRepository<KeyUsageLog, Long> {
}
