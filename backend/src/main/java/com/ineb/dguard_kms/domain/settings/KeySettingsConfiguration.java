package com.ineb.dguard_kms.domain.settings;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KeySettingsConfiguration {
    @Bean public Clock keyPolicyClock() { return Clock.system(KeySettingsService.KST); }
}
