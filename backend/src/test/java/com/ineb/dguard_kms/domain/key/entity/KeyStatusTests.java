package com.ineb.dguard_kms.domain.key.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

class KeyStatusTests {

    @Test
    void projectLifecycleMatchesTheDocumentedTransitionMatrix() {
        Map<KeyStatus, Set<KeyStatus>> expected = Map.of(
                KeyStatus.CREATED, Set.of(KeyStatus.ACTIVE, KeyStatus.DESTROYED),
                KeyStatus.ACTIVE, Set.of(
                        KeyStatus.DEACTIVATED,
                        KeyStatus.COMPROMISED,
                        KeyStatus.DESTROYED
                ),
                KeyStatus.REACTIVATED, Set.of(
                        KeyStatus.DEACTIVATED,
                        KeyStatus.COMPROMISED,
                        KeyStatus.DESTROYED
                ),
                KeyStatus.DEACTIVATED, Set.of(KeyStatus.ACTIVE, KeyStatus.COMPROMISED, KeyStatus.DESTROYED),
                KeyStatus.EXPIRED, Set.of(KeyStatus.ACTIVE, KeyStatus.COMPROMISED, KeyStatus.DESTROYED),
                KeyStatus.INACTIVE, Set.of(KeyStatus.ACTIVE, KeyStatus.COMPROMISED, KeyStatus.DESTROYED),
                KeyStatus.DISTRIBUTED, Set.of(KeyStatus.DEACTIVATED, KeyStatus.COMPROMISED, KeyStatus.DESTROYED),
                KeyStatus.COMPROMISED, Set.of(KeyStatus.DESTROYED),
                KeyStatus.DESTROYED, Set.of()
        );

        expected.forEach((status, transitions) -> assertThat(status.allowedTransitions()).isEqualTo(transitions));
        assertThat(KeyStatus.CREATED.canTransitionTo(KeyStatus.DESTROYED)).isTrue();
        assertThat(KeyStatus.DEACTIVATED.canEncrypt()).isFalse();
        assertThat(KeyStatus.DEACTIVATED.canDecrypt()).isFalse();
        assertThat(KeyStatus.DEACTIVATED.canRotate()).isTrue();
        assertThat(KeyStatus.DESTROYED.allowedTransitions()).isEmpty();
    }
}
