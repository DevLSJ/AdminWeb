package com.ineb.dguard_kms.domain.key.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "crypto_key")
public class CryptoKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "key_uid", nullable = false, unique = true, updatable = false)
    private UUID keyUid;

    @Column(name = "key_name", nullable = false, unique = true, length = 120)
    private String keyName;

    @Column(nullable = false, length = 30)
    private String algorithm;

    @Column(name = "key_size", nullable = false)
    private int keySize;

    @Column(nullable = false, length = 50)
    private String purpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private KeyStatus status;

    @Column(name = "current_version", nullable = false)
    private int currentVersion;

    @Column(name = "expire_at")
    private LocalDate expireAt;

    @Column(name = "integrity_hash", nullable = false, length = 128)
    private String integrityHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    protected CryptoKey() {
    }

    public CryptoKey(String keyName, String algorithm, int keySize, String purpose, LocalDate expireAt) {
        this.keyUid = UUID.randomUUID();
        this.keyName = keyName;
        this.algorithm = algorithm;
        this.keySize = keySize;
        this.purpose = purpose;
        this.status = KeyStatus.CREATED;
        this.currentVersion = 1;
        this.expireAt = expireAt;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (keyUid == null) keyUid = UUID.randomUUID();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void changeStatus(KeyStatus status) {
        this.status = status;
        this.updatedAt = Instant.now();
    }

    public int nextVersion() {
        this.updatedAt = Instant.now();
        return ++currentVersion;
    }

    public void updateIntegrityHash(String integrityHash) {
        this.integrityHash = integrityHash;
    }

    public Long getId() { return id; }
    public UUID getKeyUid() { return keyUid; }
    public String getKeyName() { return keyName; }
    public String getAlgorithm() { return algorithm; }
    public int getKeySize() { return keySize; }
    public String getPurpose() { return purpose; }
    public KeyStatus getStatus() { return status; }
    public int getCurrentVersion() { return currentVersion; }
    public LocalDate getExpireAt() { return expireAt; }
    public String getIntegrityHash() { return integrityHash; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
