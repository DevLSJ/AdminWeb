package com.ineb.dguard_kms.domain.key.repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ineb.dguard_kms.domain.key.entity.CryptoKey;

import jakarta.persistence.LockModeType;

public interface CryptoKeyRepository extends JpaRepository<CryptoKey, Long>, JpaSpecificationExecutor<CryptoKey> {

    Optional<CryptoKey> findByKeyUid(UUID keyUid);

    boolean existsByKeyName(String keyName);

    List<CryptoKey> findAllByIntegrityHash(String integrityHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select key from CryptoKey key where key.keyUid = :keyUid")
    Optional<CryptoKey> findForUpdateByKeyUid(@Param("keyUid") UUID keyUid);
}
