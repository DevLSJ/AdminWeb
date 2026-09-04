package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ineb.dguard_kms.domain.audit.repository.AuditLogRepository;
import com.ineb.dguard_kms.domain.auth.repository.AdminUserRepository;
import com.ineb.dguard_kms.domain.user.repository.AppUserRepository;
import com.ineb.dguard_kms.security.PasswordService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:week_three_user_audit;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
)
@Import(TestUserInitializer.class)
class WeekThreeUserAuditIntegrationTests {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void personalDataIsEncryptedMaskedAndPlainViewIsAudited() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        String adminToken = login(client, "dguard", "dguard");
        String clientToken = login(client, "client", "client");
        String superAdminToken = login(client, "admin", "admin");
        long existingEncryptedUsers = userRepository.count();
        JsonNode adminAccounts = sendJson(client, "GET", "/api/admin-accounts", adminToken, "", 200);
        assertThat(adminAccounts.path("data")).anySatisfy(account -> {
            assertThat(account.path("loginId").asText()).isEqualTo("admin");
            assertThat(account.has("passwordHash")).isFalse();
            assertThat(account.has("passwordSalt")).isFalse();
        }).anySatisfy(account -> assertThat(account.path("loginId").asText()).isEqualTo("client"));
        String clientAccountUid = findAccount(adminAccounts.path("data"), "client").path("userUid").asText();
        sendJson(client, "PUT", "/api/admin-accounts/" + clientAccountUid, adminToken,
                "{\"name\":\"클라이언트 사용자\",\"role\":\"ADMIN\"}", 403);
        String adminPhone = "010-5555-7777";
        String adminEmail = "managed-client@example.com";
        JsonNode updatedAdmin = sendJson(client, "PUT", "/api/admin-accounts/" + clientAccountUid, adminToken, """
                {"name":"클라이언트 사용자","role":"CLIENT","phone":"%s","email":"%s"}
                """.formatted(adminPhone, adminEmail), 200);
        assertThat(updatedAdmin.path("data").path("phoneMasked").asText()).isEqualTo("010-****-7777");
        assertThat(updatedAdmin.path("data").path("emailMasked").asText()).isEqualTo("ma***@example.com");
        assertThat(updatedAdmin.path("data").has("phone")).isFalse();
        assertThat(updatedAdmin.path("data").has("email")).isFalse();
        var storedAdmin = adminUserRepository.findByUserUid(UUID.fromString(clientAccountUid)).orElseThrow();
        assertThat(storedAdmin.getPhoneIv()).hasSize(12);
        assertThat(storedAdmin.getEmailIv()).hasSize(12);
        assertThat(new String(storedAdmin.getPhoneCiphertext(), StandardCharsets.UTF_8)).doesNotContain(adminPhone);
        assertThat(new String(storedAdmin.getEmailCiphertext(), StandardCharsets.UTF_8)).doesNotContain(adminEmail);
        assertThat(storedAdmin.getIntegrityHash()).isNotBlank();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "week3-" + suffix + "@example.com";
        String phone = "010-" + suffix.substring(0, 4).replaceAll("[^0-9]", "1")
                + "-" + suffix.substring(4).replaceAll("[^0-9]", "2");

        JsonNode created = sendJson(client, "POST", "/api/users", adminToken, """
                {"name":"홍길동","phone":"%s","email":"%s","password":"Week3-Secure-1234!"}
                """.formatted(phone, email), 200);
        UUID userUid = UUID.fromString(created.path("data").path("userUid").asText());
        assertThat(created.path("data").has("name")).isFalse();
        assertThat(created.path("data").path("nameMasked").asText()).isEqualTo("홍*동");
        assertThat(created.path("data").path("phoneMasked").asText()).contains("****");
        assertThat(created.path("data").path("emailMasked").asText()).endsWith("@example.com");
        assertThat(created.path("data").path("role").asText()).isEqualTo("CLIENT");
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
        assertThat(stored.getPasswordAlgorithm()).isEqualTo(PasswordService.ALGORITHM);
        assertThat(stored.getPasswordIterations()).isGreaterThanOrEqualTo(210_000);
        assertThat(Base64.getDecoder().decode(stored.getPasswordSalt())).hasSize(16);
        assertThat(Base64.getDecoder().decode(stored.getPasswordHash())).hasSize(32);
        assertThat(stored.getIntegrityHash()).isNotBlank();
        String initialPasswordHash = stored.getPasswordHash();
        String initialPasswordSalt = stored.getPasswordSalt();
        byte[] initialPhoneCiphertext = stored.getPhoneCiphertext();
        byte[] initialPhoneIv = stored.getPhoneIv();
        String initialPhoneSearchHash = stored.getPhoneSearchHash();

        sendJson(client, "PUT", "/api/users/" + userUid, adminToken, """
                {"name":"홍길동","phone":"%s","email":"%s"}
                """.formatted(phone, email), 200);
        var reEncrypted = userRepository.findByUserUid(userUid).orElseThrow();
        assertThat(Arrays.equals(reEncrypted.getPhoneCiphertext(), initialPhoneCiphertext)).isFalse();
        assertThat(Arrays.equals(reEncrypted.getPhoneIv(), initialPhoneIv)).isFalse();
        assertThat(reEncrypted.getPhoneSearchHash()).isEqualTo(initialPhoneSearchHash);

        JsonNode managedUsers = sendJson(client, "GET", "/api/users/managed?page=0&size=100", adminToken, "", 200);
        assertThat(managedUsers.path("data").path("totalElements").asLong())
                .isEqualTo(adminAccounts.path("data").size() + existingEncryptedUsers + 1L);
        assertThat(managedUsers.path("data").path("content"))
                .hasSize((int) managedUsers.path("data").path("totalElements").asLong())
                .anySatisfy(account -> {
                    assertThat(account.path("loginId").asText()).isEqualTo("admin");
                    assertThat(account.path("role").asText()).isEqualTo("S.ADMIN");
                })
                .anySatisfy(account -> {
                    assertThat(account.path("loginId").asText()).isEqualTo("client");
                    assertThat(account.path("role").asText()).isEqualTo("CLIENT");
                    assertThat(account.path("phoneMasked").asText()).isEqualTo("010-****-7777");
                    assertThat(account.path("emailMasked").asText()).isEqualTo("ma***@example.com");
                })
                .anySatisfy(account -> {
                    assertThat(account.path("loginId").asText()).isEqualTo("dguard");
                    assertThat(account.path("role").asText()).isEqualTo("ADMIN");
                })
                .anySatisfy(account -> assertThat(account.path("userUid").asText()).isEqualTo(userUid.toString()));

        JsonNode list = sendJson(client, "GET", "/api/users?page=0&size=20", adminToken, "", 200);
        JsonNode listed = findUser(list.path("data").path("content"), userUid);
        assertThat(listed.has("name")).isFalse();
        assertThat(listed.path("nameMasked").asText()).isEqualTo("홍*동");
        assertThat(listed.path("integrityValid").asBoolean()).isTrue();
        assertThat(listed.has("phonePlain")).isFalse();
        assertThat(listed.has("emailPlain")).isFalse();

        JsonNode nameSearch = sendJson(client, "GET",
                "/api/users?name=" + URLEncoder.encode("홍길동", StandardCharsets.UTF_8) + "&page=0&size=1",
                adminToken, "", 200);
        assertThat(nameSearch.path("data").path("content")).hasSize(1);
        assertThat(nameSearch.path("data").path("size").asInt()).isEqualTo(1);
        assertThat(findUser(nameSearch.path("data").path("content"), userUid).path("nameMasked").asText())
                .isEqualTo("홍*동");
        JsonNode phoneSearch = sendJson(client, "GET",
                "/api/users?phone=" + phone.replace("-", "") + "&page=0&size=20",
                adminToken, "", 200);
        assertThat(findUser(phoneSearch.path("data").path("content"), userUid).path("phoneMasked").asText())
                .contains("****");

        JsonNode forbidden = sendJson(client, "GET", "/api/users/" + userUid + "/plain?reason=permission-check", clientToken,
                "", 403);
        assertThat(forbidden.path("errorCode").asText()).isEqualTo("FORBIDDEN");
        JsonNode noReason = sendJson(client, "GET", "/api/users/" + userUid + "/plain", adminToken,
                "", 400);
        assertThat(noReason.path("errorCode").asText()).isEqualTo("INVALID_REQUEST");

        HttpResponse<String> plainResponse = send(client, "GET", "/api/users/" + userUid + "/plain?reason=identity-check", adminToken,
                "");
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
            assertThat(log.path("actor").asText()).isEqualTo("dguard");
            assertThat(log.path("detail").asText()).contains("identity-check");
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
        sendJson(client, "PATCH", "/api/users/" + userUid + "/password", adminToken,
                "{\"password\":\"Reset-Password-9876!\"}", 200);
        var passwordResetUser = userRepository.findByUserUid(userUid).orElseThrow();
        assertThat(passwordResetUser.getPasswordSalt()).isNotEqualTo(initialPasswordSalt);
        assertThat(passwordResetUser.getPasswordHash()).isNotEqualTo(initialPasswordHash);
        JsonNode inactiveUsers = sendJson(client, "GET", "/api/users?status=INACTIVE&page=0&size=20",
                adminToken, "", 200);
        assertThat(findUser(inactiveUsers.path("data").path("content"), userUid).path("integrityValid").asBoolean())
                .isTrue();

        sendJson(client, "POST", "/api/users", adminToken, """
                {"name":"관리권한사용자","phone":"010-6888-%s","email":"role-%s@example.com","password":"Role-Test-1234!","role":"ADMIN"}
                """.formatted(numericSuffix(suffix), suffix), 403);
        JsonNode adminRoleUser = sendJson(client, "POST", "/api/users", superAdminToken, """
                {"name":"관리권한사용자","phone":"010-6888-%s","email":"role-%s@example.com","password":"Role-Test-1234!","role":"ADMIN"}
                """.formatted(numericSuffix(suffix), suffix), 200);
        String adminRoleUserUid = adminRoleUser.path("data").path("userUid").asText();
        assertThat(adminRoleUser.path("data").path("role").asText()).isEqualTo("ADMIN");
        sendJson(client, "PATCH", "/api/users/" + adminRoleUserUid + "/status", adminToken,
                "{\"status\":\"INACTIVE\"}", 403);
        JsonNode superAdminUpdated = sendJson(client, "PATCH", "/api/users/" + adminRoleUserUid + "/status",
                superAdminToken, "{\"status\":\"INACTIVE\"}", 200);
        assertThat(superAdminUpdated.path("data").path("status").asText()).isEqualTo("INACTIVE");

        JsonNode verification = sendJson(client, "GET", "/api/audit-logs/verify", adminToken, "", 200);
        assertThat(verification.path("data").path("valid").asBoolean()).isTrue();
        assertThat(verification.path("data").path("headValid").asBoolean()).isTrue();
        assertThat(verification.path("data").path("checkedCount").asLong()).isPositive();
        String rangeFrom = Instant.now().minus(1, ChronoUnit.DAYS).toString();
        String rangeTo = Instant.now().plus(1, ChronoUnit.MINUTES).toString();
        JsonNode rangedVerification = sendJson(client, "GET",
                "/api/audit-logs/verify?from=" + URLEncoder.encode(rangeFrom, StandardCharsets.UTF_8)
                        + "&to=" + URLEncoder.encode(rangeTo, StandardCharsets.UTF_8),
                adminToken, "", 200);
        assertThat(rangedVerification.path("data").path("valid").asBoolean()).isTrue();
        assertThat(rangedVerification.path("data").path("checkedCount").asLong()).isPositive();
        assertThat(rangedVerification.path("data").path("rangeFrom").asText()).isEqualTo(rangeFrom);
        assertThat(rangedVerification.path("data").path("rangeTo").asText()).isEqualTo(rangeTo);
        String selectedLogUid = logs.path("data").path("content").get(0).path("logUid").asText();
        var selectedAuditLog = auditLogRepository.findByLogUid(UUID.fromString(selectedLogUid)).orElseThrow();
        String narrowFrom = selectedAuditLog.getCreatedAt().minus(1, ChronoUnit.MICROS).toString();
        String narrowTo = selectedAuditLog.getCreatedAt().plus(1, ChronoUnit.MICROS).toString();
        JsonNode boundaryVerification = sendJson(client, "GET",
                "/api/audit-logs/verify?from=" + URLEncoder.encode(narrowFrom, StandardCharsets.UTF_8)
                        + "&to=" + URLEncoder.encode(narrowTo, StandardCharsets.UTF_8),
                adminToken, "", 200);
        assertThat(boundaryVerification.path("data").path("valid").asBoolean()).isTrue();
        assertThat(boundaryVerification.path("data").path("checkedCount").asLong()).isEqualTo(1);
        assertThat(boundaryVerification.path("data").path("headValid").asBoolean()).isTrue();
        sendJson(client, "GET",
                "/api/audit-logs/verify?from=" + URLEncoder.encode(rangeTo, StandardCharsets.UTF_8)
                        + "&to=" + URLEncoder.encode(rangeFrom, StandardCharsets.UTF_8),
                adminToken, "", 400);
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
        JsonNode blocked = sendJson(client, "GET", "/api/users/" + userUid + "/plain?reason=integrity-check", token,
                "", 409);
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

    private JsonNode findAccount(JsonNode content, String loginId) {
        for (JsonNode account : content) {
            if (loginId.equals(account.path("loginId").asText())) return account;
        }
        throw new AssertionError("Account not found in response: " + loginId);
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
