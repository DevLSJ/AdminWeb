package com.ineb.dguard_kms.domain.notice.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "notice_file")
public class NoticeFile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "file_uid", nullable = false, unique = true, updatable = false)
    private UUID fileUid;
    @Column(name = "notice_id", nullable = false)
    private Long noticeId;
    @Column(name = "orig_name", nullable = false, length = 255)
    private String originalName;
    @Column(name = "saved_name", nullable = false, unique = true, length = 255)
    private String savedName;
    @Column(name = "content_type", length = 255)
    private String contentType;
    @Column(nullable = false)
    private long size;
    @Column(nullable = false)
    private byte[] iv;
    @Column(name = "content_enc")
    private byte[] encryptedContent;
    @Column(name = "enc_ver", nullable = false)
    private int encryptionVersion;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected NoticeFile() {}

    public NoticeFile(Long noticeId, String originalName, String contentType, long size, byte[] iv, byte[] encryptedContent) {
        this.fileUid = UUID.randomUUID();
        this.noticeId = noticeId;
        this.originalName = originalName;
        this.savedName = this.fileUid + ".enc";
        this.contentType = contentType;
        this.size = size;
        this.iv = iv.clone();
        this.encryptedContent = encryptedContent.clone();
        this.encryptionVersion = 1;
    }

    @PrePersist void onCreate() { if (fileUid == null) fileUid = UUID.randomUUID(); if (savedName == null) savedName = fileUid + ".enc"; createdAt = Instant.now(); }
    public UUID getFileUid() { return fileUid; }
    public Long getNoticeId() { return noticeId; }
    public String getOriginalName() { return originalName; }
    public String getContentType() { return contentType; }
    public long getSize() { return size; }
    public byte[] getIv() { return iv.clone(); }
    public byte[] getEncryptedContent() { return encryptedContent == null ? null : encryptedContent.clone(); }
    public int getEncryptionVersion() { return encryptionVersion; }
    public Instant getCreatedAt() { return createdAt; }
}
