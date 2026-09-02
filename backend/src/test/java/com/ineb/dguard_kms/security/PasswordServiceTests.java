package com.ineb.dguard_kms.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.SecureRandom;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class PasswordServiceTests {

    @Test
    void createsIndependentSaltAndHashForEveryPassword() {
        PasswordService service = new PasswordService(new SecureRandom(), new MockEnvironment());

        PasswordService.PasswordHash first = service.hash("Same-Password-1234!".toCharArray());
        PasswordService.PasswordHash second = service.hash("Same-Password-1234!".toCharArray());

        assertThat(first.algorithm()).isEqualTo(PasswordService.ALGORITHM);
        assertThat(first.iterations()).isGreaterThanOrEqualTo(PasswordService.REQUIRED_ITERATIONS);
        assertThat(Base64.getDecoder().decode(first.salt())).hasSize(16);
        assertThat(Base64.getDecoder().decode(first.hash())).hasSize(32);
        assertThat(first.salt()).isNotEqualTo(second.salt());
        assertThat(first.hash()).isNotEqualTo(second.hash());
    }

    @Test
    void rejectsConfiguredIterationCountBelowSecurityPolicy() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("kms.password.pbkdf2.iterations", "209999");

        assertThatThrownBy(() -> new PasswordService(new SecureRandom(), environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("210000");
    }
}
