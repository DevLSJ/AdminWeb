package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.Base64;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;
import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.crypto.MasterKeyService;
import com.ineb.dguard_kms.domain.config.repository.CryptoConfigRepository;
import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;
import com.ineb.dguard_kms.domain.key.repository.CryptoKeyRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyMaterialRepository;
import com.ineb.dguard_kms.domain.key.service.CryptoKeyService;

import jakarta.persistence.EntityManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestUserInitializer.class)
class KeyManagementIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CryptoKeyRepository keyRepository;

    @Autowired
    private KeyMaterialRepository materialRepository;

    @Autowired
    private CryptoConfigRepository configRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private CryptoKeyService keyService;

    @Autowired
    private CryptoUtil cryptoUtil;

    @Autowired
    private MasterKeyService masterKeyService;

    @Test
    void requiredSchemaUsesLoginIdAndPersistentMasterKeySettings() {
        assertThat(entityManager.getMetamodel().entity(AdminUser.class).getId(Long.class).getName())
                .isEqualTo("id");
        assertThat(configRepository.count()).isEqualTo(1);
        var config = configRepository.findFirstByOrderByIdAsc().orElseThrow();
        assertThat(config.getSalt()).isNotBlank();
        assertThat(config.getKcv()).isNotBlank();
        assertThat(config.getIterations()).isGreaterThanOrEqualTo(210_000);
        assertThat(config.getEncryptionVersion()).isEqualTo("v1");
    }

    @Test
    void weekOneAndTwoTablesContainEveryRequiredColumn() {
        assertColumns("crypto_config", "id", "salt", "kcv", "iterations", "enc_ver", "created_at", "updated_at");
        assertColumns("admin_user", "id", "login_id", "name", "password_hash", "password_salt",
                "password_algo", "password_iter", "role", "status", "last_login_at", "created_at", "updated_at");
        assertColumns("crypto_key", "id", "key_uid", "key_name", "algorithm", "key_size", "purpose", "status",
                "version", "expire_at", "integrity_hash", "created_by", "created_at", "updated_at");
        assertColumns("key_material", "id", "key_id", "wrapped_key", "iv", "wrap_algo", "created_at");
        assertColumns("key_status_history", "id", "key_id", "from_status", "to_status", "reason", "changed_by", "changed_at");
        assertColumns("key_usage_log", "id", "key_id", "operation", "result", "fail_reason", "used_by", "used_at");
    }

    @Test
    void keyLifecycleWrapsRotatesDistributesAndEncryptsUsingBase64() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String token = login(client, "admin", "admin");
        String keyName = "TEST-AES-" + UUID.randomUUID();

        JsonNode created = sendJson(client, "POST", "/api/keys", token, """
                {
                  "keyName":"%s",
                  "algorithm":"AES",
                  "keySize":256,
                  "purpose":"ENCRYPT",
                  "expireAt":"%s"
                }
                """.formatted(keyName, LocalDate.now().plusYears(1)), 200);
        UUID keyUid = UUID.fromString(created.path("data").path("keyUid").asText());
        assertThat(created.path("data").has("wrappedKey")).isFalse();

        JsonNode filtered = sendJson(
                client,
                "GET",
                "/api/keys?keyword=" + keyUid + "&algorithm=AES&status=CREATED&purpose=ENCRYPT&page=0&size=5",
                token,
                "",
                200
        );
        assertThat(filtered.path("data").path("totalElements").asLong()).isEqualTo(1);
        assertThat(filtered.path("data").path("content").get(0).path("keyUid").asText())
                .isEqualTo(keyUid.toString());

        var key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        KeyMaterial v1 = materialRepository.findByCryptoKeyAndKeyVersion(key, 1).orElseThrow();
        assertThat(Base64.getDecoder().decode(key.getIntegrityHash())).hasSize(32);
        assertThat(created.path("data").path("integrityValid").asBoolean()).isTrue();
        assertBinaryMaterial(v1);

        JsonNode forbidden = sendJson(client, "PATCH", "/api/keys/" + keyUid + "/status", token, """
                {"toStatus":"DESTROYED","reason":"금지 전이 검증"}
                """, 409);
        assertThat(forbidden.path("errorCode").asText()).isEqualTo("INVALID_KEY_STATUS_TRANSITION");

        JsonNode inactiveUse = sendJson(client, "POST", "/api/keys/" + keyUid + "/test/encrypt", token, """
                {"plaintext":"CREATED 상태 차단"}
                """, 400);
        assertThat(inactiveUse.path("errorCode").asText()).isEqualTo("KEY_NOT_ACTIVE");

        sendJson(client, "PATCH", "/api/keys/" + keyUid + "/status", token, """
                {"toStatus":"ACTIVE","reason":"통합 테스트 활성화"}
                """, 200);

        JsonNode updated = sendJson(client, "PUT", "/api/keys/" + keyUid, token, """
                {"keyName":"%s-UPDATED","purpose":"ENCRYPT","expireAt":"%s"}
                """.formatted(keyName, LocalDate.now().plusYears(2)), 200);
        assertThat(updated.path("data").path("keyName").asText()).endsWith("-UPDATED");

        JsonNode policy = sendJson(client, "PATCH", "/api/keys/" + keyUid + "/rotation-policy", token, """
                {"days":30}
                """, 200);
        assertThat(policy.path("data").path("autoRotationDays").asInt()).isEqualTo(30);

        JsonNode encrypted = sendJson(client, "POST", "/api/keys/" + keyUid + "/test/encrypt", token, """
                {"plaintext":"Hello DGuard"}
                """, 200);
        String ciphertext = encrypted.path("data").path("ciphertext").asText();
        String iv = encrypted.path("data").path("iv").asText();
        assertThat(encrypted.path("data").path("version").asInt()).isEqualTo(1);
        assertThat(Base64.getDecoder().decode(ciphertext)).hasSizeGreaterThan(16);
        assertThat(Base64.getDecoder().decode(iv)).hasSize(12);

        JsonNode decrypted = sendJson(client, "POST", "/api/keys/" + keyUid + "/test/decrypt", token, """
                {"ciphertext":"%s","iv":"%s"}
                """.formatted(ciphertext, iv), 200);
        assertThat(decrypted.path("data").path("plaintext").asText()).isEqualTo("Hello DGuard");

        JsonNode usage = sendJson(client, "GET", "/api/keys/" + keyUid + "/usage", token, "", 200);
        assertThat(usage.path("data").path("total").asLong()).isEqualTo(3);
        assertThat(usage.path("data").path("success").asLong()).isEqualTo(2);
        assertThat(usage.path("data").path("failure").asLong()).isEqualTo(1);
        assertThat(usage.path("data").path("encrypt").asLong()).isEqualTo(2);
        assertThat(usage.path("data").path("decrypt").asLong()).isEqualTo(1);

        byte[] wrappedBeforeRotation = v1.getWrappedKey();
        JsonNode rotated = sendJson(client, "POST", "/api/keys/" + keyUid + "/rotate", token, "{}", 200);
        assertThat(rotated.path("data").path("previousVersion").asInt()).isEqualTo(1);
        assertThat(rotated.path("data").path("newVersion").asInt()).isEqualTo(2);

        JsonNode versions = sendJson(client, "GET", "/api/keys/" + keyUid + "/versions", token, "", 200);
        assertThat(versions.path("data").size()).isEqualTo(2);
        assertThat(versions.path("data").get(0).path("version").asInt()).isEqualTo(2);
        assertThat(versions.path("data").get(0).path("decryptOnly").asBoolean()).isFalse();
        assertThat(versions.path("data").get(1).path("version").asInt()).isEqualTo(1);
        assertThat(versions.path("data").get(1).path("decryptOnly").asBoolean()).isTrue();

        JsonNode decryptedWithPreviousVersion = sendJson(
                client,
                "POST",
                "/api/keys/" + keyUid + "/test/decrypt",
                token,
                """
                {"ciphertext":"%s","iv":"%s","version":1}
                """.formatted(ciphertext, iv),
                200
        );
        assertThat(decryptedWithPreviousVersion.path("data").path("plaintext").asText())
                .isEqualTo("Hello DGuard");

        key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        KeyMaterial retiredV1 = materialRepository.findByCryptoKeyAndKeyVersion(key, 1).orElseThrow();
        KeyMaterial v2 = materialRepository.findByCryptoKeyAndKeyVersion(key, 2).orElseThrow();
        assertThat(retiredV1.getMaterialStatus()).isEqualTo(KeyMaterial.RETIRED);
        assertThat(v2.getWrappedKey()).isNotEqualTo(wrappedBeforeRotation);
        assertBinaryMaterial(v2);

        JsonNode distributed = sendJson(client, "POST", "/api/keys/" + keyUid + "/distribute", token, """
                {"target":"integration-agent","reason":"통합 테스트 배포"}
                """, 200);
        assertThat(distributed.path("data").path("status").asText()).isEqualTo("DISTRIBUTED");
        assertThat(distributed.path("data").path("wrappedKey").isMissingNode()).isTrue();
        assertThat(distributed.path("data").path("iv").isMissingNode()).isTrue();
        JsonNode distributedRotation = sendJson(client, "POST", "/api/keys/" + keyUid + "/rotate", token, "{}", 409);
        assertThat(distributedRotation.path("errorCode").asText()).isEqualTo("KEY_ROTATION_NOT_ALLOWED");

        JsonNode auditLogs = sendJson(client, "GET", "/api/audit-logs?page=0&size=100", token, "", 200);
        assertThat(auditLogs.path("data").path("content")).anySatisfy(log ->
                assertThat(log.path("targetId").asText()).isEqualTo(keyUid.toString()));
        JsonNode auditVerification = sendJson(client, "GET", "/api/audit-logs/verify", token, "", 200);
        assertThat(auditVerification.path("data").path("valid").asBoolean()).isTrue();

        key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        key.updateIntegrityHash(Base64.getEncoder().encodeToString(new byte[32]));
        keyRepository.saveAndFlush(key);
        JsonNode tampered = sendJson(client, "GET", "/api/keys/" + keyUid, token, "", 409);
        assertThat(tampered.path("errorCode").asText()).isEqualTo("KEY_INTEGRITY_VIOLATION");
        JsonNode blocked = sendJson(client, "POST", "/api/keys/" + keyUid + "/rotate", token, "{}", 409);
        assertThat(blocked.path("errorCode").asText()).isEqualTo("KEY_ROTATION_NOT_ALLOWED");
    }

    @Test
    void clientCannotCreateOrRotateKeys() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String token = login(client, "client", "client");
        HttpResponse<String> response = client.send(
                authenticatedJson("POST", "/api/keys", token, """
                        {"keyName":"DENIED","algorithm":"AES","keySize":256,"purpose":"ENCRYPT"}
                        """),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
        assertThat(response.statusCode()).isEqualTo(403);
    }

    @Test
    void schemaMigrationMarkerIsResignedOnlyWhenExplicitlyMarked() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String token = login(client, "admin", "admin");
        String keyName = "MIGRATION-AES-" + UUID.randomUUID();
        JsonNode created = sendJson(client, "POST", "/api/keys", token, """
                {"keyName":"%s","algorithm":"AES","keySize":256,"purpose":"ENCRYPT"}
                """.formatted(keyName), 200);
        UUID keyUid = UUID.fromString(created.path("data").path("keyUid").asText());

        var key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        key.updateIntegrityHash(CryptoKeyService.PENDING_SCHEMA_INTEGRITY_HASH);
        keyRepository.saveAndFlush(key);

        assertThat(keyService.resignSchemaMigratedKeys()).isEqualTo(1);
        assertThat(sendJson(client, "GET", "/api/keys/" + keyUid, token, "", 200)
                .path("data").path("integrityValid").asBoolean()).isTrue();
        assertThat(keyService.resignSchemaMigratedKeys()).isZero();
    }

    @Test
    void legacySixteenByteWrappingIvIsRewrappedToTwelveBytes() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String token = login(client, "admin", "admin");
        JsonNode created = sendJson(client, "POST", "/api/keys", token, """
                {"keyName":"LEGACY-IV-%s","algorithm":"AES","keySize":256,"purpose":"ENCRYPT"}
                """.formatted(UUID.randomUUID()), 200);
        UUID keyUid = UUID.fromString(created.path("data").path("keyUid").asText());
        var key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        KeyMaterial material = materialRepository.findByCryptoKeyAndKeyVersion(key, 1).orElseThrow();

        byte[] rawKey = cryptoUtil.unwrapKey(new CryptoUtil.Base64Payload(
                cryptoUtil.encodeBase64(material.getWrappedKey()),
                cryptoUtil.encodeBase64(material.getWrappingIv())
        ));
        byte[] legacyIv = new byte[CryptoUtil.LEGACY_IV_LENGTH_BYTES];
        new SecureRandom().nextBytes(legacyIv);
        byte[] legacyWrapped = null;
        try {
            legacyWrapped = masterKeyService.withMasterKey(masterKey -> {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, masterKey, new GCMParameterSpec(128, legacyIv));
                return cipher.doFinal(rawKey);
            });
            material.rewrap(legacyWrapped, legacyIv);
            materialRepository.saveAndFlush(material);

            assertThat(keyService.rewrapLegacyKeyMaterials()).isEqualTo(1);
            entityManager.clear();
            KeyMaterial migrated = materialRepository.findByCryptoKeyAndKeyVersion(
                    keyRepository.findByKeyUid(keyUid).orElseThrow(), 1
            ).orElseThrow();
            assertThat(migrated.getWrappingIv()).hasSize(CryptoUtil.IV_LENGTH_BYTES);
            assertThat(keyService.rewrapLegacyKeyMaterials()).isZero();
        } finally {
            Arrays.fill(rawKey, (byte) 0);
            Arrays.fill(legacyIv, (byte) 0);
            if (legacyWrapped != null) Arrays.fill(legacyWrapped, (byte) 0);
        }
    }

    private void assertBinaryMaterial(KeyMaterial material) {
        assertThat(material.getWrappingIv()).hasSize(12);
        assertThat(material.getWrappedKey()).hasSize(48);
        assertThat(new String(material.getWrappedKey(), StandardCharsets.UTF_8)).doesNotContain("AES");
    }

    @SuppressWarnings("unchecked")
    private void assertColumns(String tableName, String... requiredColumns) {
        List<String> columns = entityManager.createNativeQuery("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :tableName
                """, String.class)
                .setParameter("tableName", tableName)
                .getResultList();
        assertThat(Set.copyOf(columns)).contains(requiredColumns);
    }

    private String login(HttpClient client, String loginId, String password) throws Exception {
        HttpResponse<String> login = client.send(
                json("POST", "/api/auth/login", """
                        {"loginId":"%s","password":"%s"}
                        """.formatted(loginId, password)),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
        assertThat(login.statusCode()).isEqualTo(200);
        return objectMapper.readTree(login.body()).path("data").path("token").asText();
    }

    private JsonNode sendJson(
            HttpClient client,
            String method,
            String path,
            String token,
            String body,
            int expectedStatus
    ) throws Exception {
        HttpResponse<String> response = client.send(
                authenticatedJson(method, path, token, body),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
        assertThat(response.statusCode()).as(response.body()).isEqualTo(expectedStatus);
        return objectMapper.readTree(response.body());
    }

    private HttpRequest authenticatedJson(String method, String path, String token, String body) {
        return HttpRequest.newBuilder(endpoint(path))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
    }

    private HttpRequest json(String method, String path, String body) {
        return HttpRequest.newBuilder(endpoint(path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
    }

    private URI endpoint(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
