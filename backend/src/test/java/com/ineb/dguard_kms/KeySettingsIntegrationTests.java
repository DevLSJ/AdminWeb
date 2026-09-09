package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import com.ineb.dguard_kms.domain.audit.service.AuditLogService;
import com.ineb.dguard_kms.domain.settings.KeySettingsService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "spring.datasource.url=${KEY_SETTINGS_TEST_DATABASE_URL:jdbc:h2:mem:key_settings;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE}")
@AutoConfigureMockMvc
@Import(TestUserInitializer.class)
@Transactional
@WithMockUser(username = "admin", roles = "S.ADMIN")
class KeySettingsIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AuditLogService audit;
    @MockitoBean(name = "keyPolicyClock") Clock clock;
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 10);

    @BeforeEach void time() { at("2026-09-09T15:30:00Z"); }
    private void at(String instant) { when(clock.withZone(KeySettingsService.KST)).thenReturn(Clock.fixed(Instant.parse(instant), KeySettingsService.KST)); }

    @Test void defaultsArePersistedAndOnlyNewKeysUseChangedValidity() throws Exception {
        JsonNode original = data(get("/api/settings/key-policy"));
        assertThat(original.path("defaultValidityDays").asInt()).isEqualTo(365);
        assertThat(original.path("expiryWarningDays").asInt()).isEqualTo(30);
        JsonNode old = create("AES", "ENCRYPT", null);
        assertThat(old.path("expireAt").asText()).isEqualTo(TODAY.plusDays(365).toString());
        updatePolicy(original, 90, 7);
        JsonNode next = create("AES", "ENCRYPT", null);
        assertThat(next.path("expireAt").asText()).isEqualTo(TODAY.plusDays(90).toString());
        assertThat(data(get("/api/keys/" + old.path("keyUid").asText())).path("expireAt").asText()).isEqualTo(TODAY.plusDays(365).toString());
        assertThat(create("AES", "ENCRYPT", TODAY.plusDays(180)).path("expireAt").asText()).isEqualTo(TODAY.plusDays(180).toString());
        assertThat(audit.verifyChain().valid()).isTrue();
        assertThat(data(get("/api/audit-logs").param("action", "KEY_POLICY_UPDATE")).path("content").get(0).path("detail").asText()).contains("validity=365", "validity=90", "warning=7", "정책 시연");
    }

    @Test @WithMockUser(username = "dguard", roles = "ADMIN")
    void adminCanReadButCannotChangeEitherSetting() throws Exception {
        JsonNode policy = data(get("/api/settings/key-policy"));
        mvc.perform(json(put("/api/settings/key-policy"), policyRequest(policy, 90, 7))).andExpect(status().isForbidden());
        mvc.perform(json(patch("/api/settings/key-codes/ALGORITHM/RSA"), codeRequest(code("ALGORITHM", "RSA"), false))).andExpect(status().isForbidden());
    }

    @Test @WithMockUser(username = "client", roles = "CLIENT")
    void clientCanReadRegistrationMetadataButCannotChangePolicy() throws Exception {
        data(get("/api/settings/key-codes"));
        JsonNode policy = data(get("/api/settings/key-policy"));
        mvc.perform(json(put("/api/settings/key-policy"), policyRequest(policy, 90, 7))).andExpect(status().isForbidden());
    }

    @Test void validatesRangesReasonsAndRejectsStaleVersions() throws Exception {
        JsonNode policy = data(get("/api/settings/key-policy"));
        mvc.perform(json(put("/api/settings/key-policy"), policyRequest(policy, 0, 7))).andExpect(status().isBadRequest());
        mvc.perform(json(put("/api/settings/key-policy"), policyRequest(policy, 90, 366))).andExpect(status().isBadRequest());
        Map<String, Object> blank = new HashMap<>(policyRequest(policy, 90, 7)); blank.put("reason", "   ");
        mvc.perform(json(put("/api/settings/key-policy"), blank)).andExpect(status().isBadRequest());
        updatePolicy(policy, 90, 7);
        mvc.perform(json(put("/api/settings/key-policy"), policyRequest(policy, 180, 30))).andExpect(status().isConflict());
        assertThat(data(get("/api/settings/key-policy")).path("defaultValidityDays").asInt()).isEqualTo(90);
    }

    @Test void disabledAlgorithmBlocksNewKeysAndPreservesExistingOperations() throws Exception {
        JsonNode old = create("RSA", "ENCRYPT", null);
        String uid = old.path("keyUid").asText();
        data(json(patch("/api/keys/" + uid + "/status"), Map.of("toStatus", "ACTIVE", "reason", "시연 활성화")));
        JsonNode rsa = code("ALGORITHM", "RSA");
        data(json(patch("/api/settings/key-codes/ALGORITHM/RSA"), codeRequest(rsa, false)));
        mvc.perform(json(post("/api/keys"), keyRequest("RSA", "ENCRYPT", null))).andExpect(status().isBadRequest());
        JsonNode encrypted = data(json(post("/api/keys/" + uid + "/test/encrypt"), Map.of("plaintext", "existing key")));
        Map<String, Object> decrypt = new HashMap<>(); decrypt.put("ciphertext", encrypted.path("ciphertext").asText());
        decrypt.put("iv", encrypted.path("iv").isNull() ? null : encrypted.path("iv").asText());
        assertThat(data(json(post("/api/keys/" + uid + "/test/decrypt"), decrypt)).path("plaintext").asText()).isEqualTo("existing key");
        data(json(put("/api/keys/" + uid), Map.of("keyName", "renamed-" + UUID.randomUUID(), "purpose", "ENCRYPT", "expireAt", TODAY.plusDays(365).toString())));
        mvc.perform(json(patch("/api/settings/key-codes/ALGORITHM/RSA"), codeRequest(rsa, true))).andExpect(status().isConflict());
        assertThat(audit.verifyChain().valid()).isTrue();
    }

    @Test void unsupportedCodesAndInvalidPurposeCombinationsStayBlocked() throws Exception {
        mvc.perform(json(post("/api/keys"), keyRequest("RSA", "WRAP", null))).andExpect(status().isBadRequest());
        mvc.perform(json(post("/api/keys"), keyRequest("AES", "ARBITRARY", null))).andExpect(status().isBadRequest());
        mvc.perform(json(patch("/api/settings/key-codes/ALGORITHM/HMAC"), codeRequest(code("ALGORITHM", "HMAC"), true))).andExpect(status().isBadRequest());
        mvc.perform(json(patch("/api/settings/key-codes/STATUS/DESTROYED"), codeRequest(code("STATUS", "DESTROYED"), false))).andExpect(status().isBadRequest());
        JsonNode rsa = create("RSA", "ENCRYPT", null);
        mvc.perform(json(put("/api/keys/" + rsa.path("keyUid").asText()), Map.of("keyName", "invalid-purpose", "purpose", "WRAP", "expireAt", TODAY.plusDays(365).toString()))).andExpect(status().isBadRequest());
        data(json(patch("/api/settings/key-codes/PURPOSE/WRAP"), codeRequest(code("PURPOSE", "WRAP"), false)));
        mvc.perform(json(post("/api/keys"), keyRequest("AES", "WRAP", null))).andExpect(status().isBadRequest());
    }

    @Test void warningPolicyAndKstBoundariesAgreeAcrossDashboardAndKeyList() throws Exception {
        JsonNode five = create("AES", "ENCRYPT", TODAY.plusDays(5));
        JsonNode seven = create("AES", "ENCRYPT", TODAY.plusDays(7));
        JsonNode twenty = create("AES", "ENCRYPT", TODAY.plusDays(20));
        for (JsonNode key : List.of(five, seven, twenty)) data(json(patch("/api/keys/" + key.path("keyUid").asText() + "/status"), Map.of("toStatus", "ACTIVE", "reason", "만료 경고 시연")));
        create("AES", "ENCRYPT", TODAY.plusDays(5)); // CREATED excluded
        assertWarningCount(3);
        updatePolicy(data(get("/api/settings/key-policy")), 365, 7);
        assertWarningCount(2); // includes exactly D+7
        assertThat(data(get("/api/dashboard/expiring").param("days", "30"))).hasSize(3);
        at("2026-09-14T15:30:00Z"); // KST Sep 15: D-day included, UTC is still Sep 14
        assertWarningCount(2);
        at("2026-09-15T15:30:00Z"); // KST Sep 16: expired key excluded
        assertWarningCount(1);
    }

    private void assertWarningCount(int count) throws Exception {
        assertThat(data(get("/api/dashboard/expiring"))).hasSize(count);
        assertThat(data(get("/api/dashboard/summary")).path("expiringKeys").asInt()).isEqualTo(count);
        assertThat(data(get("/api/keys").param("category", "EXPIRING")).path("totalElements").asInt()).isEqualTo(count);
    }
    private JsonNode create(String algorithm, String purpose, LocalDate expiry) throws Exception { return data(json(post("/api/keys"), keyRequest(algorithm, purpose, expiry))); }
    private Map<String, Object> keyRequest(String algorithm, String purpose, LocalDate expiry) {
        Map<String, Object> request = new HashMap<>(Map.of("keyName", "settings-" + UUID.randomUUID(), "algorithm", algorithm, "keySize", "RSA".equals(algorithm) ? 2048 : 256, "purpose", purpose));
        if (expiry != null) request.put("expireAt", expiry.toString());
        return request;
    }
    private Map<String, Object> policyRequest(JsonNode policy, int validity, int warning) { return Map.of("defaultValidityDays", validity, "expiryWarningDays", warning, "version", policy.path("version").asLong(), "reason", "정책 시연"); }
    private void updatePolicy(JsonNode policy, int validity, int warning) throws Exception { data(json(put("/api/settings/key-policy"), policyRequest(policy, validity, warning))); }
    private JsonNode code(String group, String code) throws Exception { for (JsonNode node : data(get("/api/settings/key-codes"))) if (node.path("group").asText().equals(group) && node.path("code").asText().equals(code)) return node; throw new AssertionError(code); }
    private Map<String, Object> codeRequest(JsonNode code, boolean enabled) { return Map.of("label", code.path("label").asText(), "description", code.path("description").asText(), "sortOrder", code.path("sortOrder").asInt(), "enabled", enabled, "version", code.path("version").asLong(), "reason", "코드 시연"); }
    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception { return request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)); }
    private JsonNode data(MockHttpServletRequestBuilder request) throws Exception { return mapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data"); }
}
