package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.ineb.dguard_kms.crypto.CryptoOperationException;
import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "springdoc.api-docs.path=/api/api-docs"
)
class WeekOneIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AdminUserRepository userRepository;

    @Autowired
    private CryptoUtil cryptoUtil;

    @Test
    void initialAdminUsesSaltedPbkdf2Hash() {
        var admin = userRepository.findByLoginId("admin").orElseThrow();

        assertThat(admin.getPasswordHash()).isNotBlank().isNotEqualTo("admin");
        assertThat(admin.getPasswordSalt()).isNotBlank();
        assertThat(admin.getPasswordAlgorithm()).isEqualTo("PBKDF2WithHmacSHA256");
        assertThat(admin.getPasswordIterations()).isPositive();
    }

    @Test
    void loginAndMeRequireValidCredentialsAndJwt() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> login = client.send(jsonRequest("/api/auth/login", """
                {"loginId":"admin","password":"admin"}
                """), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

        assertThat(login.statusCode()).isEqualTo(200);
        JsonNode loginBody = objectMapper.readTree(login.body());
        assertThat(loginBody.path("success").asBoolean()).isTrue();
        assertThat(loginBody.path("data").path("role").asText()).isEqualTo("ADMIN");
        String token = loginBody.path("data").path("token").asText();
        assertThat(token).isNotBlank();

        HttpRequest meRequest = HttpRequest.newBuilder(endpoint("/api/auth/me"))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();
        HttpResponse<String> me = client.send(meRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(objectMapper.readTree(me.body()).path("data").path("loginId").asText()).isEqualTo("admin");

        HttpResponse<String> rejected = client.send(jsonRequest("/api/auth/login", """
                {"loginId":"admin","password":"wrong-password"}
                """), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertThat(rejected.statusCode()).isEqualTo(401);
        assertThat(objectMapper.readTree(rejected.body()).path("errorCode").asText()).isEqualTo("AUTHENTICATION_FAILED");

        HttpResponse<String> unauthorized = client.send(
                HttpRequest.newBuilder(endpoint("/api/auth/me")).GET().build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
        assertThat(unauthorized.statusCode()).isEqualTo(401);
    }

    @Test
    void localFrontendOriginCanUseAuthenticationApi() throws Exception {
        HttpRequest preflight = HttpRequest.newBuilder(endpoint("/api/auth/login"))
                .header("Origin", "http://127.0.0.1:15173")
                .header("Access-Control-Request-Method", "POST")
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<Void> response = HttpClient.newHttpClient().send(preflight, HttpResponse.BodyHandlers.discarding());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("access-control-allow-origin"))
                .contains("http://127.0.0.1:15173");
    }

    @Test
    void openApiDocumentIsAvailableThroughTheNginxProxyPath() throws Exception {
        HttpRequest request = HttpRequest.newBuilder(endpoint("/api/api-docs"))
                .GET()
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient().send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );

        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode document = objectMapper.readTree(response.body());
        assertThat(document.path("openapi").asText()).startsWith("3.");
        assertThat(document.path("paths").has("/api/auth/login")).isTrue();
        assertThat(document.path("paths").has("/api/auth/me")).isTrue();
    }

    @Test
    void masterKeyCryptoUsesRandomIvAndRejectsTampering() {
        byte[] plaintext = "Hello D'Guard KMS".getBytes(StandardCharsets.UTF_8);
        CryptoUtil.EncryptedPayload first = cryptoUtil.encrypt(plaintext);
        CryptoUtil.EncryptedPayload second = cryptoUtil.encrypt(plaintext);

        assertThat(first.iv()).hasSize(16).isNotEqualTo(second.iv());
        assertThat(cryptoUtil.decrypt(first)).isEqualTo(plaintext);

        byte[] damaged = first.ciphertext();
        damaged[0] ^= 1;
        CryptoUtil.EncryptedPayload tampered = new CryptoUtil.EncryptedPayload(first.iv(), damaged);
        assertThatThrownBy(() -> cryptoUtil.decrypt(tampered))
                .isInstanceOf(CryptoOperationException.class);
    }

    private HttpRequest jsonRequest(String path, String body) {
        return HttpRequest.newBuilder(endpoint(path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
    }

    private URI endpoint(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
