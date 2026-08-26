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
    @JoinColumn(name = "key_id", nullable = false)
    private CryptoKey cryptoKey;

    @Column(nullable = false, length = 16)
    private String operation;

    @Column(nullable = false, length = 8)
    private String result;

    @Column(name = "fail_reason", columnDefinition = "text")
    private String failureReason;

    @Column(name = "used_by", nullable = false, length = 64)
    private String usedBy;

    @Column(name = "used_at", nullable = false, updatable = false)
    private Instant usedAt;

    protected KeyUsageLog() {
    }

    public KeyUsageLog(CryptoKey cryptoKey, String operation, boolean success, String failureReason, String usedBy) {
        this.cryptoKey = cryptoKey;
        this.operation = operation;
        this.result = success ? "SUCCESS" : "FAILURE";
        this.failureReason = failureReason;
        this.usedBy = usedBy;
    }

    @PrePersist
    void onCreate() { usedAt = Instant.now(); }

    public String getOperation() { return operation; }
    public boolean isSuccess() { return "SUCCESS".equals(result); }
    public String getResult() { return result; }
    public String getFailureReason() { return failureReason; }
    public String getUsedBy() { return usedBy; }
    public Instant getUsedAt() { return usedAt; }
}
