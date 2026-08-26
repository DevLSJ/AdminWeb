package com.ineb.dguard_kms.domain.key.entity;

import java.util.Set;

public enum KeyStatus {
    CREATED,
    ACTIVE,
    EXPIRED,
    INACTIVE,
    DISTRIBUTED,
    COMPROMISED,
    DESTROYED;

    public Set<KeyStatus> allowedTransitions() {
        return switch (this) {
            case CREATED -> Set.of(ACTIVE);
            case ACTIVE -> Set.of(EXPIRED, INACTIVE, DISTRIBUTED, COMPROMISED);
            case EXPIRED -> Set.of(INACTIVE, ACTIVE);
            case INACTIVE, DISTRIBUTED, COMPROMISED -> Set.of(DESTROYED);
            case DESTROYED -> Set.of();
        };
    }

    public boolean canTransitionTo(KeyStatus target) {
        return target != null && allowedTransitions().contains(target);
    }
}
