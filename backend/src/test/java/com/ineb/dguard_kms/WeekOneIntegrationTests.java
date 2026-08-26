package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
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
@Import(TestUserInitializer.class)
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
    void initialUsersUseSaltedPbkdf2Hashes() {
        var admin = userRepository.findByLoginId("admin").orElseThrow();
        var client = userRepository.findByLoginId("client").orElseThrow();

        assertThat(admin.getPasswordHash()).isNotBlank().isNotEqualTo("admin");
        assertThat(admin.getPasswordSalt()).isNotBlank();
        assertThat(admin.getPasswordAlgorithm()).isEqualTo("PBKDF2WithHmacSHA256");
        assertThat(admin.getPasswordIterations()).isGreaterThanOrEqualTo(210_000);
        assertThat(admin.getRole()).isEqualTo("ADMIN");

        assertThat(client.getPasswordHash()).isNotBlank().isNotEqualTo("client");
        assertThat(client.getPasswordSalt()).isNotBlank();
        assertThat(client.getPasswordAlgorithm()).isEqualTo("PBKDF2WithHmacSHA256");
        assertThat(client.getPasswordIterations()).isGreaterThanOrEqualTo(210_000);
        assertThat(client.getRole()).isEqualTo("CLIENT");
        assertThat(client.getPasswordSalt()).isNotEqualTo(admin.getPasswordSalt());
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
        JsonNode tokenClaims = objectMapper.readTree(Base64.getUrlDecoder().decode(token.split("\\.")[1]));
        assertThat(tokenClaims.path("exp").asLong() - tokenClaims.path("iat").asLong()).isEqualTo(3_600L);

        HttpRequest meRequest = HttpRequest.newBuilder(endpoint("/api/auth/me"))
                .header("Authorization", "Bearer " + token)
                .GET()
                .build();
        HttpResponse<String> me = client.send(meRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertThat(me.statusCode()).isEqualTo(200);
        assertThat(objectMapper.readTree(me.body()).path("data").path("loginId").asText()).isEqualTo("admin");

        HttpRequest refreshRequest = HttpRequest.newBuilder(endpoint("/api/auth/refresh"))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        HttpResponse<String> refresh = client.send(refreshRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertThat(refresh.statusCode()).isEqualTo(200);
        JsonNode refreshBody = objectMapper.readTree(refresh.body());
        assertThat(refreshBody.path("data").path("token").asText()).isNotBlank();
        assertThat(refreshBody.path("data").path("loginId").asText()).isEqualTo("admin");

        HttpRequest refreshedMeRequest = HttpRequest.newBuilder(endpoint("/api/auth/me"))
                .header("Authorization", "Bearer " + refreshBody.path("data").path("token").asText())
                .GET()
                .build();
        HttpResponse<String> refreshedMe = client.send(refreshedMeRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertThat(refreshedMe.statusCode()).isEqualTo(200);

        HttpResponse<String> clientLogin = client.send(jsonRequest("/api/auth/login", """
                {"loginId":"client","password":"client"}
                """), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertThat(clientLogin.statusCode()).isEqualTo(200);
        JsonNode clientLoginBody = objectMapper.readTree(clientLogin.body());
        assertThat(clientLoginBody.path("data").path("loginId").asText()).isEqualTo("client");
        assertThat(clientLoginBody.path("data").path("role").asText()).isEqualTo("CLIENT");
        assertThat(clientLoginBody.path("data").path("token").asText()).isNotBlank();

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
        assertThat(document.path("info").path("title").asText()).isEqualTo("D'Guard KMS API");
        assertThat(document.path("paths").has("/api/auth/login")).isTrue();
        assertThat(document.path("paths").has("/api/auth/me")).isTrue();
        assertThat(document.path("paths").has("/api/auth/refresh")).isTrue();
        assertThat(document.path("paths").path("/api/auth/login").path("post").path("summary").asText())
                .isEqualTo("로그인");
        assertThat(document.path("components").path("schemas").path("LoginRequest").path("description").asText())
                .isEqualTo("로그인 요청 정보");
    }

    @Test
    void masterKeyCryptoUsesRandomIvAndRejectsTampering() {
        byte[] plaintext = "Hello D'Guard KMS".getBytes(StandardCharsets.UTF_8);
        CryptoUtil.EncryptedPayload first = cryptoUtil.encrypt(plaintext);
        CryptoUtil.EncryptedPayload second = cryptoUtil.encrypt(plaintext);

        assertThat(first.iv()).hasSize(12).isNotEqualTo(second.iv());
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
