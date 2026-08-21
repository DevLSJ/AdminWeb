package com.ineb.dguard_kms.domain.key.dto;

public record KeyEncryptResponse(String ciphertext, String iv, String encoding) {
}
