package com.ineb.dguard_kms.domain.key.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class KeyIntegrityMigrationInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(KeyIntegrityMigrationInitializer.class);

    private final CryptoKeyService keyService;

    public KeyIntegrityMigrationInitializer(CryptoKeyService keyService) {
        this.keyService = keyService;
    }

    @Override
    public void run(ApplicationArguments args) {
        int resigned = keyService.resignSchemaMigratedKeys();
        if (resigned > 0) {
            log.info("Re-signed {} legacy key integrity hashes after the week-two schema migration", resigned);
        }
    }
}
