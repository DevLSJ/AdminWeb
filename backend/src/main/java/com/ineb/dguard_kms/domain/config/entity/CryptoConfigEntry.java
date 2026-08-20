package com.ineb.dguard_kms.domain.config.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "crypto_config")
public class CryptoConfigEntry {

    @Id
    @Column(name = "config_key", length = 100)
    private String configKey;

    @Column(name = "config_value", nullable = false, length = 2048)
    private String configValue;

    protected CryptoConfigEntry() {
    }

    public CryptoConfigEntry(String configKey, String configValue) {
        this.configKey = configKey;
        this.configValue = configValue;
    }

    public String getConfigKey() {
        return configKey;
    }

    public String getConfigValue() {
        return configValue;
    }
}
