package com.ineb.dguard_kms.domain.key.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
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

    @Column(name = "key_name", nullable = false, unique = true, length = 128)
    private String keyName;

    @Column(nullable = false, length = 32)
    private String algorithm;

    @Column(name = "key_size", nullable = false)
    private int keySize;

    @Column(nullable = false, length = 32)
    private String purpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private KeyStatus status;

    @Column(nullable = false)
    private int version;

    @Column(name = "expire_at")
    private Instant expireAt;

    @Column(name = "integrity_hash", nullable = false, length = 512)
    private String integrityHash;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "auto_rotation_days")
    private Integer autoRotationDays;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    protected CryptoKey() {
    }

    public CryptoKey(String keyName, String algorithm, int keySize, String purpose, LocalDate expireAt, String createdBy) {
        this.keyUid = UUID.randomUUID();
        this.keyName = keyName;
        this.algorithm = algorithm;
        this.keySize = keySize;
        this.purpose = purpose;
        this.status = KeyStatus.CREATED;
        this.version = 1;
        this.expireAt = toInstant(expireAt);
        this.createdBy = createdBy;
        // PostgreSQL TIMESTAMPTZ stores microsecond precision.  The integrity
        // signature includes this value, so sign the exact precision that will
        // be persisted rather than an Instant with nanoseconds that PostgreSQL
        // truncates on write.
        this.createdAt = databaseTimestampNow();
        this.updatedAt = this.createdAt;
    }

    @PrePersist
    void onCreate() {
        Instant now = databaseTimestampNow();
        if (keyUid == null) keyUid = UUID.randomUUID();
        if (createdAt == null) createdAt = now;
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
        return ++version;
    }

    public void updateIntegrityHash(String integrityHash) {
        this.integrityHash = integrityHash;
    }

    public void updateMetadata(String keyName, String purpose, LocalDate expireAt) {
        this.keyName = keyName;
        this.purpose = purpose;
        this.expireAt = toInstant(expireAt);
        this.updatedAt = Instant.now();
    }

    public void updateAutoRotationDays(Integer autoRotationDays) {
        this.autoRotationDays = autoRotationDays;
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public UUID getKeyUid() { return keyUid; }
    public String getKeyName() { return keyName; }
    public String getAlgorithm() { return algorithm; }
    public int getKeySize() { return keySize; }
    public String getPurpose() { return purpose; }
    public KeyStatus getStatus() { return status; }
    public int getCurrentVersion() { return version; }
    public LocalDate getExpireAt() { return expireAt == null ? null : expireAt.atZone(ZoneOffset.UTC).toLocalDate(); }
    public Instant getExpireAtInstant() { return expireAt; }
    public String getIntegrityHash() { return integrityHash; }
    public String getCreatedBy() { return createdBy; }
    public Integer getAutoRotationDays() { return autoRotationDays; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    private static Instant toInstant(LocalDate value) {
        return value == null ? null : value.atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static Instant databaseTimestampNow() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
