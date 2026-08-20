package com.ineb.dguard_kms.domain.config.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.config.entity.CryptoConfigEntry;

public interface CryptoConfigRepository extends JpaRepository<CryptoConfigEntry, String> {
}
