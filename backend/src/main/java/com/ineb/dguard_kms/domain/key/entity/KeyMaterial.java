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

@Entity
@Table(name = "key_material")
public class KeyMaterial {

    public static final String ACTIVE = "ACTIVE";
    public static final String RETIRED = "RETIRED";
    public static final String DISTRIBUTED = "DISTRIBUTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "key_id", nullable = false)
    private CryptoKey cryptoKey;

    @Column(name = "key_version", nullable = false)
    private int keyVersion;

    @Column(name = "wrapped_key", nullable = false, columnDefinition = "bytea")
    private byte[] wrappedKey;

    @Column(name = "iv", nullable = false, columnDefinition = "bytea")
    private byte[] wrappingIv;

    @Column(name = "wrap_algo", nullable = false, length = 32)
    private String wrappingAlgorithm;

    @Column(name = "material_status", nullable = false, length = 30)
    private String materialStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "retired_at")
    private Instant retiredAt;

    @Column(name = "distributed_at")
    private Instant distributedAt;

    @Column(name = "created_by", nullable = false, length = 100)
    private String createdBy;

    protected KeyMaterial() {
    }

    public KeyMaterial(CryptoKey cryptoKey, int keyVersion, byte[] wrappedKey, byte[] wrappingIv, String createdBy) {
        this.cryptoKey = cryptoKey;
        this.keyVersion = keyVersion;
        this.wrappedKey = wrappedKey.clone();
        this.wrappingIv = wrappingIv.clone();
        this.wrappingAlgorithm = "AES-256-GCM";
        this.materialStatus = ACTIVE;
        this.createdBy = createdBy;
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

    public void rewrap(byte[] wrappedKey, byte[] wrappingIv) {
        this.wrappedKey = wrappedKey.clone();
        this.wrappingIv = wrappingIv.clone();
        this.wrappingAlgorithm = "AES-256-GCM";
    }

    public Long getId() { return id; }
    public CryptoKey getCryptoKey() { return cryptoKey; }
    public int getKeyVersion() { return keyVersion; }
    public byte[] getWrappedKey() { return wrappedKey.clone(); }
    public byte[] getWrappingIv() { return wrappingIv.clone(); }
    public String getWrappingAlgorithm() { return wrappingAlgorithm; }
    public String getMaterialStatus() { return materialStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getRetiredAt() { return retiredAt; }
    public Instant getDistributedAt() { return distributedAt; }
    public String getCreatedBy() { return createdBy; }
}
