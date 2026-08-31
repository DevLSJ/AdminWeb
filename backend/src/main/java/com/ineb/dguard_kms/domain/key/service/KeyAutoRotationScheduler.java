package com.ineb.dguard_kms.domain.key.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class KeyAutoRotationScheduler {

    private static final Logger log = LoggerFactory.getLogger(KeyAutoRotationScheduler.class);
    private static final String SYSTEM_ACTOR = "kms-auto-rotation";

    private final CryptoKeyService keyService;

    public KeyAutoRotationScheduler(CryptoKeyService keyService) {
        this.keyService = keyService;
    }

    @Scheduled(cron = "${kms.rotation.cron:0 0 2 * * *}", zone = "UTC")
    public void rotateDueKeys() {
        for (UUID keyUid : keyService.autoRotationCandidates()) {
            try {
                keyService.rotateIfDue(keyUid, SYSTEM_ACTOR);
            } catch (RuntimeException exception) {
                log.error("Automatic rotation failed for key {}", keyUid, exception);
            }
        }
    }
}
