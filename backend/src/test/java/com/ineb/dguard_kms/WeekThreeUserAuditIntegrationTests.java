package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ineb.dguard_kms.domain.audit.repository.AuditLogRepository;
import com.ineb.dguard_kms.domain.user.repository.AppUserRepository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestUserInitializer.class)
class WeekThreeUserAuditIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void personalDataIsEncryptedMaskedAndPlainViewIsAudited() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String adminToken = login(client, "admin", "admin");
        String clientToken = login(client, "client", "client");
        JsonNode adminAccounts = sendJson(client, "GET", "/api/admin-accounts", adminToken, "", 200);
        assertThat(adminAccounts.path("data")).anySatisfy(account -> {
            assertThat(account.path("loginId").asText()).isEqualTo("admin");
            assertThat(account.has("passwordHash")).isFalse();
            assertThat(account.has("passwordSalt")).isFalse();
        }).anySatisfy(account -> assertThat(account.path("loginId").asText()).isEqualTo("client"));
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "week3-" + suffix + "@example.com";
        String phone = "010-" + suffix.substring(0, 4).replaceAll("[^0-9]", "1")
                + "-" + suffix.substring(4).replaceAll("[^0-9]", "2");

        JsonNode created = sendJson(client, "POST", "/api/users", adminToken, """
                {"name":"홍길동","phone":"%s","email":"%s","password":"Week3-Secure-1234!"}
                """.formatted(phone, email), 200);
        UUID userUid = UUID.fromString(created.path("data").path("userUid").asText());
        assertThat(created.path("data").path("name").asText()).isEqualTo("홍길동");
        assertThat(created.path("data").path("nameMasked").asText()).isEqualTo("홍*동");
        assertThat(created.path("data").path("phoneMasked").asText()).contains("****");
        assertThat(created.path("data").path("emailMasked").asText()).endsWith("@example.com");
        assertThat(created.path("data").has("phone")).isFalse();
        assertThat(created.path("data").has("email")).isFalse();

        JsonNode duplicate = sendJson(client, "POST", "/api/users", adminToken, """
                {"name":"중복사용자","phone":"%s","email":"%s","password":"Week3-Duplicate-1234!"}
                """.formatted(phone, email), 409);
        assertThat(duplicate.path("errorCode").asText()).isEqualTo("USER_DUPLICATE");

        var stored = userRepository.findByUserUid(userUid).orElseThrow();
        assertThat(new String(stored.getNameCiphertext(), StandardCharsets.UTF_8)).doesNotContain("홍길동");
        assertThat(new String(stored.getPhoneCiphertext(), StandardCharsets.UTF_8)).doesNotContain(phone);
        assertThat(new String(stored.getEmailCiphertext(), StandardCharsets.UTF_8)).doesNotContain(email);
        assertThat(stored.getNameIv()).hasSize(12);
        assertThat(stored.getPhoneIv()).hasSize(12);
        assertThat(stored.getEmailIv()).hasSize(12);
        assertThat(stored.getPasswordHash()).isNotEqualTo("Week3-Secure-1234!");
        assertThat(stored.getPasswordIterations()).isGreaterThanOrEqualTo(210_000);
        assertThat(stored.getIntegrityHash()).isNotBlank();

        JsonNode list = sendJson(client, "GET", "/api/users?page=0&size=20", adminToken, "", 200);
        JsonNode listed = findUser(list.path("data").path("content"), userUid);
        assertThat(listed.path("name").asText()).isEqualTo("홍길동");
        assertThat(listed.path("integrityValid").asBoolean()).isTrue();
        assertThat(listed.has("phonePlain")).isFalse();
        assertThat(listed.has("emailPlain")).isFalse();

        JsonNode forbidden = sendJson(client, "POST", "/api/users/" + userUid + "/plain", clientToken,
                "{\"reason\":\"권한 검증\"}", 403);
        assertThat(forbidden.path("errorCode").asText()).isEqualTo("FORBIDDEN");
        JsonNode noReason = sendJson(client, "POST", "/api/users/" + userUid + "/plain", adminToken,
                "{\"reason\":\"\"}", 400);
        assertThat(noReason.path("errorCode").asText()).isEqualTo("VALIDATION_FAILED");

        HttpResponse<String> plainResponse = send(client, "POST", "/api/users/" + userUid + "/plain", adminToken,
                "{\"reason\":\"본인 확인 요청 처리\"}");
        assertThat(plainResponse.statusCode()).isEqualTo(200);
        assertThat(plainResponse.headers().firstValue("cache-control")).hasValueSatisfying(value ->
                assertThat(value).contains("no-store"));
        JsonNode plain = objectMapper.readTree(plainResponse.body()).path("data");
        assertThat(plain.path("name").asText()).isEqualTo("홍길동");
        assertThat(plain.path("phone").asText()).isEqualTo(phone);
        assertThat(plain.path("email").asText()).isEqualTo(email);

        JsonNode logs = sendJson(client, "GET",
                "/api/audit-logs?action=USER_VIEW_PLAIN&page=0&size=100", adminToken, "", 200);
        assertThat(logs.path("data").path("content")).anySatisfy(log -> {
            assertThat(log.path("targetId").asText()).isEqualTo(userUid.toString());
            assertThat(log.path("actor").asText()).isEqualTo("admin");
            assertThat(log.path("detail").asText()).contains("본인 확인 요청 처리");
            assertThat(log.path("detail").asText()).doesNotContain(phone, email, "홍길동");
        });

        JsonNode updated = sendJson(client, "PUT", "/api/users/" + userUid, adminToken, """
                {"name":"김보안","phone":"010-3333-7777","email":"secure-%s@example.com"}
                """.formatted(suffix), 200);
        assertThat(updated.path("data").path("nameMasked").asText()).isEqualTo("김*안");
        assertThat(updated.path("data").path("integrityValid").asBoolean()).isTrue();

        JsonNode status = sendJson(client, "PATCH", "/api/users/" + userUid + "/status", adminToken,
                "{\"status\":\"INACTIVE\"}", 200);
        assertThat(status.path("data").path("status").asText()).isEqualTo("INACTIVE");
        sendJson(client, "POST", "/api/users/" + userUid + "/password", adminToken,
                "{\"password\":\"Reset-Password-9876!\"}", 200);

        JsonNode verification = sendJson(client, "GET", "/api/audit-logs/verify", adminToken, "", 200);
        assertThat(verification.path("data").path("valid").asBoolean()).isTrue();
        assertThat(verification.path("data").path("headValid").asBoolean()).isTrue();
        assertThat(verification.path("data").path("checkedCount").asLong()).isPositive();
        String selectedLogUid = logs.path("data").path("content").get(0).path("logUid").asText();
        JsonNode entryVerification = sendJson(client, "GET", "/api/audit-logs/" + selectedLogUid + "/verify", adminToken, "", 200);
        assertThat(entryVerification.path("data").path("valid").asBoolean()).isTrue();
        assertThat(entryVerification.path("data").path("rowHashValid").asBoolean()).isTrue();
        assertThat(entryVerification.path("data").path("previousLinkValid").asBoolean()).isTrue();
        assertThat(entryVerification.path("data").path("nextLinkValid").asBoolean()).isTrue();

        HttpResponse<String> csv = send(client, "GET",
                "/api/audit-logs/export?action=USER_VIEW_PLAIN", adminToken, "");
        assertThat(csv.statusCode()).isEqualTo(200);
        assertThat(csv.headers().firstValue("content-disposition").orElse("")).contains("attachment");
        assertThat(csv.body()).contains("USER_VIEW_PLAIN", userUid.toString(), "rowHash");
        JsonNode afterExport = sendJson(client, "GET", "/api/audit-logs/verify", adminToken, "", 200);
        assertThat(afterExport.path("data").path("valid").asBoolean()).isTrue();
    }

    @Test
    void userIntegrityViolationBlocksPlaintextAndAuditTamperingIsDetected() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String token = login(client, "admin", "admin");
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        JsonNode created = sendJson(client, "POST", "/api/users", token, """
                {"name":"무결성검증","phone":"010-5555-%s","email":"integrity-%s@example.com","password":"Integrity-1234!"}
                """.formatted(numericSuffix(suffix), suffix), 200);
        UUID userUid = UUID.fromString(created.path("data").path("userUid").asText());

        jdbcTemplate.update("UPDATE app_user SET phone_masked = ? WHERE user_uid = ?", "010-****-0000", userUid);
        JsonNode blocked = sendJson(client, "POST", "/api/users/" + userUid + "/plain", token,
                "{\"reason\":\"무결성 실패 검증\"}", 409);
        assertThat(blocked.path("errorCode").asText()).isEqualTo("USER_INTEGRITY_VIOLATION");
        JsonNode list = sendJson(client, "GET", "/api/users?page=0&size=100", token, "", 200);
        assertThat(findUser(list.path("data").path("content"), userUid).path("integrityValid").asBoolean()).isFalse();

        var lastLog = auditLogRepository.findTopByOrderByIdDesc().orElseThrow();
        String originalDetail = lastLog.getDetail();
        jdbcTemplate.update("UPDATE audit_log SET detail = ? WHERE id = ?", "tampered-audit-detail", lastLog.getId());
        JsonNode invalid = sendJson(client, "GET", "/api/audit-logs/verify", token, "", 200);
        assertThat(invalid.path("data").path("valid").asBoolean()).isFalse();
        assertThat(invalid.path("data").path("invalidLogUids")).anySatisfy(uid ->
                assertThat(uid.asText()).isEqualTo(lastLog.getLogUid().toString()));

        jdbcTemplate.update("UPDATE audit_log SET detail = ? WHERE id = ?", originalDetail, lastLog.getId());
        JsonNode restored = sendJson(client, "GET", "/api/audit-logs/verify", token, "", 200);
        assertThat(restored.path("data").path("valid").asBoolean()).isTrue();
    }

    private String numericSuffix(String value) {
        String digits = value.replaceAll("[^0-9]", "7");
        return digits.substring(0, 4);
    }

    private JsonNode findUser(JsonNode content, UUID userUid) {
        for (JsonNode user : content) {
            if (userUid.toString().equals(user.path("userUid").asText())) return user;
        }
        throw new AssertionError("User not found in response: " + userUid);
    }

    private String login(HttpClient client, String loginId, String password) throws Exception {
        HttpResponse<String> response = send(client, "POST", "/api/auth/login", null,
                "{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}");
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        return objectMapper.readTree(response.body()).path("data").path("token").asText();
    }

    private JsonNode sendJson(
            HttpClient client,
            String method,
            String path,
            String token,
            String body,
            int expectedStatus
    ) throws Exception {
        HttpResponse<String> response = send(client, method, path, token, body);
        assertThat(response.statusCode()).as(response.body()).isEqualTo(expectedStatus);
        return objectMapper.readTree(response.body());
    }

    private HttpResponse<String> send(
            HttpClient client,
            String method,
            String path,
            String token,
            String body
    ) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(endpoint(path));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (!"GET".equals(method)) builder.header("Content-Type", "application/json");
        HttpRequest.BodyPublisher publisher = body.isEmpty()
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8);
        return client.send(builder.method(method, publisher).build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private URI endpoint(String path) {
        return URI.create("http://127.0.0.1:" + port + path);
    }
}
