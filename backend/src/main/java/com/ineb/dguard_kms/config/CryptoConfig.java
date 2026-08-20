package com.ineb.dguard_kms.config;

import java.security.SecureRandom;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CryptoConfig {

    @Bean
    SecureRandom secureRandom() {
        return new SecureRandom();
    }
}
