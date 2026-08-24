package com.ineb.dguard_kms;

import java.util.Arrays;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.security.PasswordService;

@TestConfiguration(proxyBeanMethods = false)
class TestUserInitializer {

    @Bean
    ApplicationRunner testUsers(AdminUserRepository repository, PasswordService passwordService) {
        return (ApplicationArguments args) -> {
            createIfMissing(repository, passwordService, "admin", "admin", "관리자", "ADMIN");
            createIfMissing(repository, passwordService, "client", "client", "클라이언트 사용자", "CLIENT");
        };
    }

    private void createIfMissing(
            AdminUserRepository repository,
            PasswordService passwordService,
            String loginId,
            String rawPassword,
            String name,
            String role
    ) {
        if (repository.existsByLoginId(loginId)) {
            return;
        }

        char[] password = rawPassword.toCharArray();
        try {
            PasswordService.PasswordHash encoded = passwordService.hash(password);
            repository.save(new AdminUser(
                    loginId,
                    encoded.hash(),
                    encoded.salt(),
                    encoded.algorithm(),
                    encoded.iterations(),
                    name,
                    role
            ));
        } finally {
            Arrays.fill(password, '\0');
        }
    }
}
