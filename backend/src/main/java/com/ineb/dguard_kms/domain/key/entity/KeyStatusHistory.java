package com.ineb.dguard_kms.domain.key.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "key_status_history")
public class KeyStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "crypto_key_id", nullable = false)
    private CryptoKey cryptoKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30)
    private KeyStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30)
    private KeyStatus toStatus;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(name = "changed_by", nullable = false, length = 100)
    private String changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected KeyStatusHistory() {
    }

    public KeyStatusHistory(CryptoKey cryptoKey, KeyStatus fromStatus, KeyStatus toStatus, String reason, String changedBy) {
        this.cryptoKey = cryptoKey;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.reason = reason;
        this.changedBy = changedBy;
    }

    @PrePersist
    void onCreate() { changedAt = Instant.now(); }

    public Long getId() { return id; }
    public KeyStatus getFromStatus() { return fromStatus; }
    public KeyStatus getToStatus() { return toStatus; }
    public String getReason() { return reason; }
    public String getChangedBy() { return changedBy; }
    public Instant getChangedAt() { return changedAt; }
}
