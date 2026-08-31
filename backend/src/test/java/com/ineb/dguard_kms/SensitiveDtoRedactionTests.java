package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.ineb.dguard_kms.domain.auth.dto.LoginRequest;
import com.ineb.dguard_kms.domain.auth.dto.LoginResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyDecryptResponse;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptRequest;
import com.ineb.dguard_kms.domain.key.dto.KeyEncryptResponse;
import com.ineb.dguard_kms.domain.user.dto.UserCreateRequest;
import com.ineb.dguard_kms.domain.user.dto.UserPasswordResetRequest;
import com.ineb.dguard_kms.domain.user.dto.UserPlainResponse;
import com.ineb.dguard_kms.domain.user.dto.UserPlainViewRequest;
import com.ineb.dguard_kms.domain.user.dto.UserUpdateRequest;

class SensitiveDtoRedactionTests {

    @Test
    void sensitiveRequestAndResponseValuesAreRedactedFromLogs() {
        UUID userUid = UUID.randomUUID();

        assertRedacted(new LoginRequest("admin", "login-secret"), "login-secret");
        assertRedacted(new LoginResponse("jwt-secret", userUid, "admin", "관리자", "ADMIN"), "jwt-secret");
        assertRedacted(
                new UserCreateRequest("홍길동", "010-1234-5678", "private@example.com", "password-secret"),
                "홍길동", "010-1234-5678", "private@example.com", "password-secret"
        );
        assertRedacted(
                new UserUpdateRequest("김보안", "010-9876-5432", "updated@example.com"),
                "김보안", "010-9876-5432", "updated@example.com"
        );
        assertRedacted(new UserPlainViewRequest("민감한 조회 사유"), "민감한 조회 사유");
        assertRedacted(
                new UserPlainResponse(userUid, "이원문", "010-1111-2222", "plain@example.com", 1),
                "이원문", "010-1111-2222", "plain@example.com"
        );
        assertRedacted(new UserPasswordResetRequest("new-password-secret"), "new-password-secret");
        assertRedacted(new KeyEncryptRequest("sensitive-plaintext", 2), "sensitive-plaintext");
        assertRedacted(
                new KeyEncryptResponse("sensitive-ciphertext", "sensitive-iv", "Base64", 2),
                "sensitive-ciphertext", "sensitive-iv"
        );
        assertRedacted(
                new KeyDecryptRequest("decrypt-ciphertext", "decrypt-iv", 2),
                "decrypt-ciphertext", "decrypt-iv"
        );
        assertRedacted(new KeyDecryptResponse("decrypted-plaintext"), "decrypted-plaintext");
    }

    private void assertRedacted(Object dto, String... secrets) {
        assertThat(dto.toString()).contains("REDACTED");
        assertThat(dto.toString()).doesNotContain(secrets);
    }
}
