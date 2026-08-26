package com.ineb.dguard_kms.domain.key.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

class KeyStatusTests {

    @Test
    void projectLifecycleMatchesTheDocumentedTransitionMatrix() {
        Map<KeyStatus, Set<KeyStatus>> expected = Map.of(
                KeyStatus.CREATED, Set.of(KeyStatus.ACTIVE),
                KeyStatus.ACTIVE, Set.of(
                        KeyStatus.EXPIRED,
                        KeyStatus.INACTIVE,
                        KeyStatus.DISTRIBUTED,
                        KeyStatus.COMPROMISED
                ),
                KeyStatus.EXPIRED, Set.of(KeyStatus.INACTIVE, KeyStatus.ACTIVE),
                KeyStatus.INACTIVE, Set.of(KeyStatus.DESTROYED),
                KeyStatus.DISTRIBUTED, Set.of(KeyStatus.DESTROYED),
                KeyStatus.COMPROMISED, Set.of(KeyStatus.DESTROYED),
                KeyStatus.DESTROYED, Set.of()
        );

        expected.forEach((status, transitions) -> assertThat(status.allowedTransitions()).isEqualTo(transitions));
        assertThat(KeyStatus.CREATED.canTransitionTo(KeyStatus.DESTROYED)).isFalse();
        assertThat(KeyStatus.DESTROYED.allowedTransitions()).isEmpty();
    }
}
