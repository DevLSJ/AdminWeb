package com.ineb.dguard_kms.config;

import java.util.Arrays;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.security.PasswordService;

@Component
public class DataInitializer implements ApplicationRunner {

    private final AdminUserRepository userRepository;
    private final PasswordService passwordService;

    public DataInitializer(AdminUserRepository userRepository, PasswordService passwordService) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        createUserIfMissing(
                "admin",
                new char[] { 'a', 'd', 'm', 'i', 'n' },
                "관리자",
                "ADMIN"
        );
        createUserIfMissing(
                "client",
                new char[] { 'c', 'l', 'i', 'e', 'n', 't' },
                "클라이언트 사용자",
                "CLIENT"
        );
    }

    private void createUserIfMissing(String loginId, char[] initialPassword, String name, String role) {
        if (userRepository.existsByLoginId(loginId)) {
            Arrays.fill(initialPassword, '\0');
            return;
        }

        try {
            PasswordService.PasswordHash encoded = passwordService.hash(initialPassword);
            userRepository.save(new AdminUser(
                    loginId,
                    encoded.hash(),
                    encoded.salt(),
                    encoded.algorithm(),
                    encoded.iterations(),
                    name,
                    role
            ));
        } finally {
            Arrays.fill(initialPassword, '\0');
        }
    }
}
