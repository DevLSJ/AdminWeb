package com.ineb.dguard_kms.domain.settings;

import java.time.Instant;
import jakarta.persistence.*;

@Entity
@Table(name = "key_policy")
public class KeyPolicy {
    @Id private Long id = 1L;
    @Column(nullable = false) private int defaultValidityDays = 365;
    @Column(nullable = false) private int expiryWarningDays = 30;
    @Column(nullable = false, length = 100) private String updatedBy = "SYSTEM";
    @Column(nullable = false) private Instant updatedAt = Instant.now();
    @Version private long version;
    public KeyPolicy() { }
    public void update(int validity, int warning, String actor) {
        defaultValidityDays = validity; expiryWarningDays = warning; updatedBy = actor; updatedAt = Instant.now();
    }
    public int getDefaultValidityDays() { return defaultValidityDays; }
    public int getExpiryWarningDays() { return expiryWarningDays; }
    public String getUpdatedBy() { return updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
