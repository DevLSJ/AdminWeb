package com.ineb.dguard_kms.domain.audit.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "log_uid", nullable = false, unique = true, updatable = false)
    private UUID logUid;

    @Column(nullable = false, length = 100)
    private String actor;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "target_type", nullable = false, length = 50)
    private String targetType;

    @Column(name = "target_id", nullable = false, length = 150)
    private String targetId;

    @Column(nullable = false, length = 1000)
    private String detail;

    @Column(name = "prev_hash", length = 128, updatable = false)
    private String previousHash;

    @Column(name = "row_hash", nullable = false, length = 128, updatable = false)
    private String rowHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AuditLog() {
    }

    public AuditLog(
            UUID logUid,
            String actor,
            String action,
            String targetType,
            String targetId,
            String detail,
            String previousHash,
            String rowHash,
            Instant createdAt
    ) {
        this.logUid = logUid;
        this.actor = actor;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.detail = detail;
        this.previousHash = previousHash;
        this.rowHash = rowHash;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public UUID getLogUid() { return logUid; }
    public String getActor() { return actor; }
    public String getAction() { return action; }
    public String getTargetType() { return targetType; }
    public String getTargetId() { return targetId; }
    public String getDetail() { return detail; }
    public String getPreviousHash() { return previousHash; }
    public String getRowHash() { return rowHash; }
    public Instant getCreatedAt() { return createdAt; }
}
