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
    DESTROYED;

    public Set<KeyStatus> allowedTransitions() {
        return switch (this) {
            case CREATED -> Set.of(ACTIVE, DESTROYED);
            case ACTIVE, REACTIVATED, DISTRIBUTED -> Set.of(DEACTIVATED, DESTROYED);
            case DEACTIVATED, EXPIRED, INACTIVE -> Set.of(ACTIVE, DESTROYED);
            case DESTROYED -> Set.of();
        };
    }

    public boolean canTransitionTo(KeyStatus target) {
        return target != null && allowedTransitions().contains(target);
    }

    public boolean canEncrypt() {
        return this == ACTIVE || this == REACTIVATED || this == DISTRIBUTED;
    }

    public boolean canDecrypt() {
        return canEncrypt();
    }

    public boolean canRotate() {
        return canEncrypt() || this == DEACTIVATED || this == EXPIRED || this == INACTIVE;
    }
}
