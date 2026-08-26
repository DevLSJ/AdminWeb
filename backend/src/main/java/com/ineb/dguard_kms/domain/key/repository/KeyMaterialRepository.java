package com.ineb.dguard_kms.domain.key.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.ineb.dguard_kms.domain.key.entity.CryptoKey;
import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;

public interface KeyMaterialRepository extends JpaRepository<KeyMaterial, Long> {

    @Query(value = "select * from key_material where octet_length(iv) <> 12", nativeQuery = true)
    List<KeyMaterial> findAllWithLegacyWrappingIv();

    Optional<KeyMaterial> findByCryptoKeyAndKeyVersion(CryptoKey cryptoKey, int keyVersion);

    List<KeyMaterial> findAllByCryptoKeyOrderByKeyVersionDesc(CryptoKey cryptoKey);

    void deleteByCryptoKey(CryptoKey cryptoKey);
}
