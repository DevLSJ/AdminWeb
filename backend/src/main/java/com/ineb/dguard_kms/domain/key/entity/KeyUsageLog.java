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
@Table(name = "key_usage_log")
public class KeyUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "crypto_key_id", nullable = false)
    private CryptoKey cryptoKey;

    @Column(nullable = false, length = 30)
    private String operation;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    @Column(name = "used_by", nullable = false, length = 100)
    private String usedBy;

    @Column(name = "used_at", nullable = false, updatable = false)
    private Instant usedAt;

    protected KeyUsageLog() {
    }

    public KeyUsageLog(CryptoKey cryptoKey, String operation, boolean success, String failureReason, String usedBy) {
        this.cryptoKey = cryptoKey;
        this.operation = operation;
        this.success = success;
        this.failureReason = failureReason;
        this.usedBy = usedBy;
    }

    @PrePersist
    void onCreate() { usedAt = Instant.now(); }

    public String getOperation() { return operation; }
    public boolean isSuccess() { return success; }
    public String getFailureReason() { return failureReason; }
    public String getUsedBy() { return usedBy; }
    public Instant getUsedAt() { return usedAt; }
}
