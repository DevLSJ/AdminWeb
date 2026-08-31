package com.ineb.dguard_kms.domain.key.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class KeyIntegrityScheduler {

    private static final Logger log = LoggerFactory.getLogger(KeyIntegrityScheduler.class);

    private final CryptoKeyService keyService;

    public KeyIntegrityScheduler(CryptoKeyService keyService) {
        this.keyService = keyService;
    }

    @Scheduled(cron = "${kms.integrity.verification-cron:0 30 1 * * *}", zone = "UTC")
    public void verifyAllKeys() {
        var report = keyService.verifyAllIntegrity();
        if (report.invalidKeys() == 0) {
            log.info("Scheduled key integrity verification completed: {} keys valid", report.totalKeys());
            return;
        }
        report.keys().stream()
                .filter(result -> !result.valid())
                .forEach(result -> log.error(
                        "Key integrity violation: keyUid={}, status={}, violations={}, invalidVersions={}",
                        result.keyUid(), result.status(), result.violations(), result.invalidVersions()
                ));
    }
}
