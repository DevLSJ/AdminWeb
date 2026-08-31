package com.ineb.dguard_kms.domain.key.entity;

import java.util.Set;

public enum KeyStatus {
    CREATED,
    ACTIVE,
    REACTIVATED,
    DEACTIVATED,
    EXPIRED,
    INACTIVE,
    DISTRIBUTED,
    COMPROMISED,
    DESTROYED;

    public Set<KeyStatus> allowedTransitions() {
        return switch (this) {
            case CREATED -> Set.of(ACTIVE);
            case ACTIVE -> Set.of(DEACTIVATED, EXPIRED, INACTIVE, DISTRIBUTED, COMPROMISED);
            case REACTIVATED -> Set.of(DEACTIVATED, EXPIRED, INACTIVE, DISTRIBUTED, COMPROMISED);
            case DEACTIVATED -> Set.of(REACTIVATED, DESTROYED);
            case EXPIRED -> Set.of(INACTIVE, REACTIVATED);
            case INACTIVE, DISTRIBUTED, COMPROMISED -> Set.of(DESTROYED);
            case DESTROYED -> Set.of();
        };
    }

    public boolean canTransitionTo(KeyStatus target) {
        return target != null && allowedTransitions().contains(target);
    }

    public boolean canEncrypt() {
        return this == ACTIVE || this == REACTIVATED;
    }

    public boolean canDecrypt() {
        return this == ACTIVE || this == DEACTIVATED;
    }
}
