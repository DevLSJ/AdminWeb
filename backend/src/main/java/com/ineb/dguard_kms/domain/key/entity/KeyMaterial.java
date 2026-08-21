package com.ineb.dguard_kms.domain.key.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "key_material",
        uniqueConstraints = @UniqueConstraint(name = "uk_key_material_version", columnNames = { "crypto_key_id", "key_version" })
)
public class KeyMaterial {

    public static final String ACTIVE = "ACTIVE";
    public static final String RETIRED = "RETIRED";
    public static final String DISTRIBUTED = "DISTRIBUTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "crypto_key_id", nullable = false)
    private CryptoKey cryptoKey;

    @Column(name = "key_version", nullable = false)
    private int keyVersion;

    @Column(name = "wrapped_key", nullable = false, length = 4096)
    private String wrappedKey;

    @Column(name = "wrapping_iv", nullable = false, length = 128)
    private String wrappingIv;

    @Column(name = "wrapping_algorithm", nullable = false, length = 50)
    private String wrappingAlgorithm;

    @Column(name = "material_status", nullable = false, length = 30)
    private String materialStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "retired_at")
    private Instant retiredAt;

    @Column(name = "distributed_at")
    private Instant distributedAt;

    protected KeyMaterial() {
    }

    public KeyMaterial(CryptoKey cryptoKey, int keyVersion, String wrappedKey, String wrappingIv) {
        this.cryptoKey = cryptoKey;
        this.keyVersion = keyVersion;
        this.wrappedKey = wrappedKey;
        this.wrappingIv = wrappingIv;
        this.wrappingAlgorithm = "AES-256-GCM";
        this.materialStatus = ACTIVE;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public void retire() {
        this.materialStatus = RETIRED;
        this.retiredAt = Instant.now();
    }

    public void markDistributed() {
        this.materialStatus = DISTRIBUTED;
        this.distributedAt = Instant.now();
    }

    public Long getId() { return id; }
    public CryptoKey getCryptoKey() { return cryptoKey; }
    public int getKeyVersion() { return keyVersion; }
    public String getWrappedKey() { return wrappedKey; }
    public String getWrappingIv() { return wrappingIv; }
    public String getWrappingAlgorithm() { return wrappingAlgorithm; }
    public String getMaterialStatus() { return materialStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getRetiredAt() { return retiredAt; }
    public Instant getDistributedAt() { return distributedAt; }
}
