package com.ineb.dguard_kms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DguardKmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(DguardKmsApplication.class, args);
    }
}
