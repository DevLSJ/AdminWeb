package com.ineb.dguard_kms.domain.key.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;

public interface KeyMaterialRepository extends JpaRepository<KeyMaterial, Long> {

    Optional<KeyMaterial> findByCryptoKeyAndKeyVersion(CryptoKey cryptoKey, int keyVersion);

    List<KeyMaterial> findAllByCryptoKeyOrderByKeyVersionDesc(CryptoKey cryptoKey);
}
