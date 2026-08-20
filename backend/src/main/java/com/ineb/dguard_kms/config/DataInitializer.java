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
        if (userRepository.existsByLoginId("admin")) {
            return;
        }

        char[] initialPassword = { 'a', 'd', 'm', 'i', 'n' };
        try {
            PasswordService.PasswordHash encoded = passwordService.hash(initialPassword);
            userRepository.save(new AdminUser(
                    "admin",
                    encoded.hash(),
                    encoded.salt(),
                    encoded.algorithm(),
                    encoded.iterations(),
                    "관리자",
                    "ADMIN"
            ));
        } finally {
            Arrays.fill(initialPassword, '\0');
        }
    }
}
