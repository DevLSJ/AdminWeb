package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.security.PasswordService;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:user_provisioning;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "app.user-provisioning.enabled=true",
        "app.user-provisioning.login-id=provisioned-admin",
        "app.user-provisioning.password=one-time-secret",
        "app.user-provisioning.name=Provisioned Admin",
        "app.user-provisioning.role=admin"
})
class UserProvisioningIntegrationTests {

    @Autowired
    private AdminUserRepository userRepository;

    @Autowired
    private PasswordService passwordService;

    @Test
    void explicitlyEnabledProvisioningStoresOnlySaltedPasswordHash() {
        var user = userRepository.findByLoginId("provisioned-admin").orElseThrow();

        assertThat(user.getPasswordHash()).isNotEqualTo("one-time-secret");
        assertThat(user.getPasswordSalt()).isNotBlank();
        assertThat(user.getPasswordAlgorithm()).isEqualTo(PasswordService.ALGORITHM);
        assertThat(user.getPasswordIterations()).isGreaterThanOrEqualTo(210_000);
        assertThat(user.getRole()).isEqualTo("ADMIN");

        char[] password = "one-time-secret".toCharArray();
        try {
            assertThat(passwordService.matches(password, user)).isTrue();
        } finally {
            java.util.Arrays.fill(password, '\0');
        }
    }
}
