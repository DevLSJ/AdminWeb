package com.ineb.dguard_kms.domain.config.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.config.entity.CryptoConfigEntry;

public interface CryptoConfigRepository extends JpaRepository<CryptoConfigEntry, Long> {
    Optional<CryptoConfigEntry> findFirstByOrderByIdAsc();
}
