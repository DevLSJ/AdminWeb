package com.ineb.dguard_kms.domain.user.entity;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import jakarta.persistence.Version;

@Entity
@Table(name = "app_user")
public class AppUser {

    public static final int CURRENT_ENCRYPTION_VERSION = 1;
    public static final String ACTIVE = "ACTIVE";
    public static final String INACTIVE = "INACTIVE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_uid", nullable = false, unique = true, updatable = false)
    private UUID userUid;

    @Column(name = "name_ciphertext", nullable = false, columnDefinition = "bytea")
    private byte[] nameCiphertext;

    @Column(name = "name_iv", nullable = false, columnDefinition = "bytea")
    private byte[] nameIv;

    @Column(name = "name_masked", nullable = false, length = 64)
    private String nameMasked;

    @Column(name = "name_search_hash", nullable = false, length = 128)
    private String nameSearchHash;

    @Column(name = "phone_ciphertext", nullable = false, columnDefinition = "bytea")
    private byte[] phoneCiphertext;

    @Column(name = "phone_iv", nullable = false, columnDefinition = "bytea")
    private byte[] phoneIv;

    @Column(name = "phone_masked", nullable = false, length = 32)
    private String phoneMasked;

    @Column(name = "phone_search_hash", nullable = false, unique = true, length = 128)
    private String phoneSearchHash;

    @Column(name = "email_ciphertext", nullable = false, columnDefinition = "bytea")
    private byte[] emailCiphertext;

    @Column(name = "email_iv", nullable = false, columnDefinition = "bytea")
    private byte[] emailIv;

    @Column(name = "email_masked", nullable = false, length = 256)
    private String emailMasked;

    @Column(name = "email_search_hash", nullable = false, unique = true, length = 128)
    private String emailSearchHash;

    @Column(name = "password_hash", nullable = false, length = 512)
    private String passwordHash;

    @Column(name = "password_salt", nullable = false, length = 256)
    private String passwordSalt;

    @Column(name = "password_algo", nullable = false, length = 32)
    private String passwordAlgorithm;

    @Column(name = "password_iter", nullable = false)
    private int passwordIterations;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "integrity_hash", nullable = false, length = 512)
    private String integrityHash;

    @Column(name = "enc_ver", nullable = false)
    private int encryptionVersion;

    @Column(name = "created_by", nullable = false, updatable = false, length = 64)
    private String createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    protected AppUser() {
    }

    public AppUser(
            UUID userUid,
            byte[] nameCiphertext,
            byte[] nameIv,
            String nameMasked,
            String nameSearchHash,
            byte[] phoneCiphertext,
            byte[] phoneIv,
            String phoneMasked,
            String phoneSearchHash,
            byte[] emailCiphertext,
            byte[] emailIv,
            String emailMasked,
            String emailSearchHash,
            String passwordHash,
            String passwordSalt,
            String passwordAlgorithm,
            int passwordIterations,
            String createdBy
    ) {
        this.userUid = userUid;
        replacePersonalData(
                nameCiphertext, nameIv, nameMasked, nameSearchHash,
                phoneCiphertext, phoneIv, phoneMasked, phoneSearchHash,
                emailCiphertext, emailIv, emailMasked, emailSearchHash,
                CURRENT_ENCRYPTION_VERSION
        );
        replacePassword(passwordHash, passwordSalt, passwordAlgorithm, passwordIterations);
        this.status = ACTIVE;
        this.integrityHash = "PENDING";
        this.createdBy = createdBy;
    }

    public void replacePersonalData(
            byte[] nameCiphertext,
            byte[] nameIv,
            String nameMasked,
            String nameSearchHash,
            byte[] phoneCiphertext,
            byte[] phoneIv,
            String phoneMasked,
            String phoneSearchHash,
            byte[] emailCiphertext,
            byte[] emailIv,
            String emailMasked,
            String emailSearchHash,
            int encryptionVersion
    ) {
        this.nameCiphertext = copy(nameCiphertext);
        this.nameIv = copy(nameIv);
        this.nameMasked = nameMasked;
        this.nameSearchHash = nameSearchHash;
        this.phoneCiphertext = copy(phoneCiphertext);
        this.phoneIv = copy(phoneIv);
        this.phoneMasked = phoneMasked;
        this.phoneSearchHash = phoneSearchHash;
        this.emailCiphertext = copy(emailCiphertext);
        this.emailIv = copy(emailIv);
        this.emailMasked = emailMasked;
        this.emailSearchHash = emailSearchHash;
        this.encryptionVersion = encryptionVersion;
    }

    public void replacePassword(String hash, String salt, String algorithm, int iterations) {
        this.passwordHash = hash;
        this.passwordSalt = salt;
        this.passwordAlgorithm = algorithm;
        this.passwordIterations = iterations;
    }

    public void changeStatus(String status) {
        if (!ACTIVE.equals(status) && !INACTIVE.equals(status)) {
            throw new IllegalArgumentException("사용자 상태는 ACTIVE 또는 INACTIVE여야 합니다.");
        }
        this.status = status;
    }

    public void updateIntegrityHash(String integrityHash) {
        this.integrityHash = integrityHash;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (userUid == null) userUid = UUID.randomUUID();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static byte[] copy(byte[] value) {
        return Arrays.copyOf(value, value.length);
    }

    public Long getId() { return id; }
    public UUID getUserUid() { return userUid; }
    public byte[] getNameCiphertext() { return copy(nameCiphertext); }
    public byte[] getNameIv() { return copy(nameIv); }
    public String getNameMasked() { return nameMasked; }
    public String getNameSearchHash() { return nameSearchHash; }
    public byte[] getPhoneCiphertext() { return copy(phoneCiphertext); }
    public byte[] getPhoneIv() { return copy(phoneIv); }
    public String getPhoneMasked() { return phoneMasked; }
    public String getPhoneSearchHash() { return phoneSearchHash; }
    public byte[] getEmailCiphertext() { return copy(emailCiphertext); }
    public byte[] getEmailIv() { return copy(emailIv); }
    public String getEmailMasked() { return emailMasked; }
    public String getEmailSearchHash() { return emailSearchHash; }
    public String getPasswordHash() { return passwordHash; }
    public String getPasswordSalt() { return passwordSalt; }
    public String getPasswordAlgorithm() { return passwordAlgorithm; }
    public int getPasswordIterations() { return passwordIterations; }
    public String getStatus() { return status; }
    public String getIntegrityHash() { return integrityHash; }
    public int getEncryptionVersion() { return encryptionVersion; }
    public String getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getLockVersion() { return lockVersion; }
}
