package com.ineb.dguard_kms.domain.config.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "crypto_config")
public class CryptoConfigEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 512)
    private String salt;

    @Column(nullable = false, length = 512)
    private String kcv;

    @Column(nullable = false)
    private int iterations;

    @Column(name = "enc_ver", nullable = false, length = 16)
    private String encryptionVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CryptoConfigEntry() {
    }

    public CryptoConfigEntry(String salt, String kcv, int iterations) {
        this.salt = salt;
        this.kcv = kcv;
        this.iterations = iterations;
        this.encryptionVersion = "v1";
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getSalt() { return salt; }
    public String getKcv() { return kcv; }
    public int getIterations() { return iterations; }
    public String getEncryptionVersion() { return encryptionVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
