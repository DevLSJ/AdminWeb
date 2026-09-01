package com.ineb.dguard_kms.domain.notice.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "notice")
public class Notice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "notice_uid", nullable = false, unique = true, updatable = false)
    private UUID noticeUid;
    @Column(nullable = false, length = 255)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    @Column(name = "expose_yn", nullable = false, length = 1)
    private String exposeYn;
    @Column(name = "view_count", nullable = false)
    private long viewCount;
    @Column(name = "created_by", nullable = false, length = 64, updatable = false)
    private String createdBy;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Notice() {}

    public Notice(String title, String content, String exposeYn, String createdBy) {
        this.noticeUid = UUID.randomUUID();
        this.title = title;
        this.content = content;
        this.exposeYn = exposeYn;
        this.createdBy = createdBy;
    }

    @PrePersist void onCreate() { Instant now = Instant.now(); if (noticeUid == null) noticeUid = UUID.randomUUID(); createdAt = now; updatedAt = now; }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }

    public void update(String title, String content, String exposeYn) { this.title = title; this.content = content; this.exposeYn = exposeYn; }
    public void incrementViewCount() { viewCount++; }
    public Long getId() { return id; }
    public UUID getNoticeUid() { return noticeUid; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getExposeYn() { return exposeYn; }
    public long getViewCount() { return viewCount; }
    public String getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
