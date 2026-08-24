package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.ineb.dguard_kms.domain.auth.entity.AdminUser;
import com.ineb.dguard_kms.domain.config.repository.CryptoConfigRepository;
import com.ineb.dguard_kms.domain.key.entity.KeyMaterial;
import com.ineb.dguard_kms.domain.key.repository.CryptoKeyRepository;
import com.ineb.dguard_kms.domain.key.repository.KeyMaterialRepository;

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

    @Test
    void requiredSchemaUsesLoginIdAndPersistentMasterKeySettings() {
        assertThat(entityManager.getMetamodel().entity(AdminUser.class).getId(String.class).getName())
                .isEqualTo("loginId");
        assertThat(configRepository.findById("master.salt")).isPresent();
        assertThat(configRepository.findById("master.kcv")).isPresent();
        assertThat(configRepository.findById("master.algorithm").orElseThrow().getConfigValue())
                .isEqualTo("PBKDF2WithHmacSHA256");
        assertThat(Integer.parseInt(configRepository.findById("master.iterations").orElseThrow().getConfigValue()))
                .isGreaterThanOrEqualTo(210_000);
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

        var key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        KeyMaterial v1 = materialRepository.findByCryptoKeyAndKeyVersion(key, 1).orElseThrow();
        assertThat(Base64.getDecoder().decode(key.getIntegrityHash())).hasSize(32);
        assertThat(created.path("data").path("integrityValid").asBoolean()).isTrue();
        assertBase64Material(v1);

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
        assertThat(Base64.getDecoder().decode(ciphertext)).hasSizeGreaterThan(16);
        assertThat(Base64.getDecoder().decode(iv)).hasSize(16);

        JsonNode decrypted = sendJson(client, "POST", "/api/keys/" + keyUid + "/test/decrypt", token, """
                {"ciphertext":"%s","iv":"%s"}
                """.formatted(ciphertext, iv), 200);
        assertThat(decrypted.path("data").path("plaintext").asText()).isEqualTo("Hello DGuard");

        JsonNode usage = sendJson(client, "GET", "/api/keys/" + keyUid + "/usage", token, "", 200);
        assertThat(usage.path("data").path("total").asLong()).isEqualTo(2);
        assertThat(usage.path("data").path("success").asLong()).isEqualTo(2);
        assertThat(usage.path("data").path("encrypt").asLong()).isEqualTo(1);
        assertThat(usage.path("data").path("decrypt").asLong()).isEqualTo(1);

        JsonNode rotated = sendJson(client, "POST", "/api/keys/" + keyUid + "/rotate", token, "{}", 200);
        assertThat(rotated.path("data").path("previousVersion").asInt()).isEqualTo(1);
        assertThat(rotated.path("data").path("newVersion").asInt()).isEqualTo(2);

        JsonNode versions = sendJson(client, "GET", "/api/keys/" + keyUid + "/versions", token, "", 200);
        assertThat(versions.path("data").size()).isEqualTo(2);
        assertThat(versions.path("data").get(0).path("version").asInt()).isEqualTo(2);
        assertThat(versions.path("data").get(1).path("decryptOnly").asBoolean()).isTrue();

        key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        KeyMaterial savedV1 = materialRepository.findByCryptoKeyAndKeyVersion(key, 1).orElseThrow();
        KeyMaterial v2 = materialRepository.findByCryptoKeyAndKeyVersion(key, 2).orElseThrow();
        assertThat(savedV1.getMaterialStatus()).isEqualTo(KeyMaterial.RETIRED);
        assertThat(v2.getWrappedKey()).isNotEqualTo(savedV1.getWrappedKey());
        assertBase64Material(v2);

        JsonNode distributed = sendJson(client, "POST", "/api/keys/" + keyUid + "/distribute", token, """
                {"target":"integration-agent","reason":"통합 테스트 배포"}
                """, 200);
        assertThat(distributed.path("data").path("status").asText()).isEqualTo("DISTRIBUTED");
        assertThat(distributed.path("data").path("wrappedKey").isMissingNode()).isTrue();
        assertThat(distributed.path("data").path("iv").isMissingNode()).isTrue();

        JsonNode auditLogs = sendJson(client, "GET", "/api/audit-logs?page=0&size=100", token, "", 200);
        assertThat(auditLogs.path("data").path("content")).anySatisfy(log ->
                assertThat(log.path("targetId").asText()).isEqualTo(keyUid.toString()));
        JsonNode auditVerification = sendJson(client, "GET", "/api/audit-logs/verify", token, "", 200);
        assertThat(auditVerification.path("data").path("valid").asBoolean()).isTrue();

        key = keyRepository.findByKeyUid(keyUid).orElseThrow();
        key.updateIntegrityHash(Base64.getEncoder().encodeToString(new byte[32]));
        keyRepository.saveAndFlush(key);
        JsonNode tampered = sendJson(client, "GET", "/api/keys/" + keyUid, token, "", 200);
        assertThat(tampered.path("data").path("integrityValid").asBoolean()).isFalse();
        JsonNode blocked = sendJson(client, "POST", "/api/keys/" + keyUid + "/rotate", token, "{}", 409);
        assertThat(blocked.path("errorCode").asText()).isEqualTo("KEY_INTEGRITY_VIOLATION");
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

    private void assertBase64Material(KeyMaterial material) {
        assertThat(Base64.getDecoder().decode(material.getWrappingIv())).hasSize(16);
        assertThat(Base64.getDecoder().decode(material.getWrappedKey())).hasSize(48);
        assertThat(material.getWrappedKey()).doesNotContain("=").doesNotContain("AES");
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
