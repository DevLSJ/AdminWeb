package com.ineb.dguard_kms.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.SecureRandom;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;

class PasswordServiceTests {

    @Test
    void createsIndependentSaltAndHashForEveryPassword() {
        PasswordService service = new PasswordService(new SecureRandom(), new MockEnvironment());

        PasswordService.PasswordHash first = service.hash("Same-Password-1234!".toCharArray());
        PasswordService.PasswordHash second = service.hash("Same-Password-1234!".toCharArray());

        assertThat(first.algorithm()).isEqualTo(PasswordService.ALGORITHM);
        assertThat(first.iterations()).isEqualTo(10_000);
        assertThat(Base64.getDecoder().decode(first.salt())).hasSize(16);
        assertThat(Base64.getDecoder().decode(first.hash())).hasSize(32);
        assertThat(first.salt()).isNotEqualTo(second.salt());
        assertThat(first.hash()).isNotEqualTo(second.hash());
    }

    @Test
    void verifiesExistingHashesUsingTheirStoredIterations() {
        PasswordService previousPolicy = new PasswordService(new SecureRandom(), new MockEnvironment()
                .withProperty("kms.password.pbkdf2.iterations", "210000"));
        PasswordService.PasswordHash existing = previousPolicy.hash("Existing-Password-1234!".toCharArray());
        AdminUser user = new AdminUser("existing", existing.hash(), existing.salt(), existing.algorithm(),
                existing.iterations(), "Existing user", "CLIENT");
        PasswordService currentPolicy = new PasswordService(new SecureRandom(), new MockEnvironment());

        assertThat(currentPolicy.matches("Existing-Password-1234!".toCharArray(), user)).isTrue();
        assertThat(currentPolicy.matches("Wrong-Password-1234!".toCharArray(), user)).isFalse();
        assertThat(currentPolicy.hash("Existing-Password-1234!".toCharArray()).iterations()).isEqualTo(10_000);
    }

    @Test
    void rejectsConfiguredIterationCountBelowSecurityPolicy() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("kms.password.pbkdf2.iterations", "9999");

        assertThatThrownBy(() -> new PasswordService(new SecureRandom(), environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("10000");
    }
}
