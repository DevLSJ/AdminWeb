package com.ineb.dguard_kms.config;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.security.PasswordService;

@Component
@ConditionalOnProperty(name = "app.user-provisioning.enabled", havingValue = "true")
public class UserProvisioningInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(UserProvisioningInitializer.class);
    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "CLIENT");

    private final AdminUserRepository userRepository;
    private final PasswordService passwordService;
    private final Environment environment;

    public UserProvisioningInitializer(
            AdminUserRepository userRepository,
            PasswordService passwordService,
            Environment environment
    ) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String loginId = requiredProperty("app.user-provisioning.login-id");
        if (userRepository.existsByLoginId(loginId)) {
            log.info("User provisioning skipped because login ID '{}' already exists", loginId);
            return;
        }

        String name = requiredProperty("app.user-provisioning.name");
        String role = requiredProperty("app.user-provisioning.role").toUpperCase(Locale.ROOT);
        if (!ALLOWED_ROLES.contains(role)) {
            throw new IllegalStateException("Provisioning role must be ADMIN or CLIENT");
        }

        char[] password = requiredSecretProperty("app.user-provisioning.password").toCharArray();
        try {
            PasswordService.PasswordHash encoded = passwordService.hash(password);
            userRepository.save(new AdminUser(
                    loginId,
                    encoded.hash(),
                    encoded.salt(),
                    encoded.algorithm(),
                    encoded.iterations(),
                    name,
                    role
            ));
            log.info("Provisioned user '{}' with role '{}'", loginId, role);
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    private String requiredProperty(String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Required user provisioning property is missing: " + key);
        }
        return value.trim();
    }

    private String requiredSecretProperty(String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isEmpty()) {
            throw new IllegalStateException("Required user provisioning property is missing: " + key);
        }
        return value;
    }
}
