package com.ineb.dguard_kms.domain.key.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.key.entity.KeyUsageLog;
import com.ineb.dguard_kms.domain.key.entity.CryptoKey;

public interface KeyUsageLogRepository extends JpaRepository<KeyUsageLog, Long> {
    long countByResult(String result);
    java.util.List<KeyUsageLog> findAllByUsedAtGreaterThanEqualAndUsedAtLessThan(java.time.Instant from, java.time.Instant to);
    long countByCryptoKey(CryptoKey cryptoKey);
    long countByCryptoKeyAndResult(CryptoKey cryptoKey, String result);
    long countByCryptoKeyAndOperation(CryptoKey cryptoKey, String operation);
    void deleteByCryptoKey(CryptoKey cryptoKey);
}
