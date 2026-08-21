package com.ineb.dguard_kms.domain.key.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyStatusHistory;

public interface KeyStatusHistoryRepository extends JpaRepository<KeyStatusHistory, Long> {
    List<KeyStatusHistory> findAllByCryptoKeyOrderByChangedAtDesc(CryptoKey cryptoKey);
}
