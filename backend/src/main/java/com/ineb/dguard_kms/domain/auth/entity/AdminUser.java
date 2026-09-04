package com.ineb.dguard_kms.domain.auth.entity;

import java.time.Instant;
import java.util.Arrays;
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
@Table(name = "admin_user")
public class AdminUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_uid", nullable = false, unique = true, updatable = false)
    private UUID userUid;

    @Column(name = "login_id", nullable = false, unique = true, length = 64)
    private String loginId;

    @Column(name = "password_hash", nullable = false, length = 512)
    private String passwordHash;

    @Column(name = "password_salt", nullable = false, length = 256)
    private String passwordSalt;

    @Column(name = "password_algo", nullable = false, length = 32)
    private String passwordAlgorithm;

    @Column(name = "password_iter", nullable = false)
    private int passwordIterations;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "phone_ciphertext", columnDefinition = "bytea")
    private byte[] phoneCiphertext;

    @Column(name = "phone_iv", columnDefinition = "bytea")
    private byte[] phoneIv;

    @Column(name = "phone_masked", length = 32)
    private String phoneMasked;

    @Column(name = "email_ciphertext", columnDefinition = "bytea")
    private byte[] emailCiphertext;

    @Column(name = "email_iv", columnDefinition = "bytea")
    private byte[] emailIv;

    @Column(name = "email_masked", length = 256)
    private String emailMasked;

    @Column(name = "contact_enc_ver")
    private Integer contactEncryptionVersion;

    @Column(nullable = false, length = 32)
    private String role;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "integrity_hash", length = 128)
    private String integrityHash;

    protected AdminUser() {
    }

    public AdminUser(
            String loginId,
            String passwordHash,
            String passwordSalt,
            String passwordAlgorithm,
            int passwordIterations,
            String name,
            String role
    ) {
        this.userUid = UUID.randomUUID();
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.passwordSalt = passwordSalt;
        this.passwordAlgorithm = passwordAlgorithm;
        this.passwordIterations = passwordIterations;
        this.name = name;
        this.role = role;
        this.status = "ACTIVE";
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (userUid == null) userUid = UUID.randomUUID();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getUserUid() {
        return userUid;
    }

    public String getLoginId() {
        return loginId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getPasswordSalt() {
        return passwordSalt;
    }

    public String getPasswordAlgorithm() {
        return passwordAlgorithm;
    }

    public int getPasswordIterations() {
        return passwordIterations;
    }

    public String getName() {
        return name;
    }

    public byte[] getPhoneCiphertext() { return copy(phoneCiphertext); }
    public byte[] getPhoneIv() { return copy(phoneIv); }
    public String getPhoneMasked() { return phoneMasked; }
    public byte[] getEmailCiphertext() { return copy(emailCiphertext); }
    public byte[] getEmailIv() { return copy(emailIv); }
    public String getEmailMasked() { return emailMasked; }
    public Integer getContactEncryptionVersion() { return contactEncryptionVersion; }

    public String getRole() {
        return role;
    }

    public String getStatus() {
        return status;
    }

    public boolean isActive() {
        return "ACTIVE".equals(status);
    }

    public void recordLogin() {
        lastLoginAt = Instant.now();
    }

    public void updateProfile(String name, String role) { this.name = name; this.role = role; }
    public void replacePhone(byte[] ciphertext, byte[] iv, String masked) {
        this.phoneCiphertext = copy(ciphertext);
        this.phoneIv = copy(iv);
        this.phoneMasked = masked;
        this.contactEncryptionVersion = 1;
    }
    public void replaceEmail(byte[] ciphertext, byte[] iv, String masked) {
        this.emailCiphertext = copy(ciphertext);
        this.emailIv = copy(iv);
        this.emailMasked = masked;
        this.contactEncryptionVersion = 1;
    }
    public void changeStatus(String status) { this.status = status; }
    public void replacePassword(String hash, String salt, String algorithm, int iterations) {
        this.passwordHash = hash;
        this.passwordSalt = salt;
        this.passwordAlgorithm = algorithm;
        this.passwordIterations = iterations;
    }
    public void updateIntegrityHash(String integrityHash) { this.integrityHash = integrityHash; }

    public Long getId() { return id; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public String getIntegrityHash() { return integrityHash; }

    private byte[] copy(byte[] value) {
        return value == null ? null : Arrays.copyOf(value, value.length);
    }
}
