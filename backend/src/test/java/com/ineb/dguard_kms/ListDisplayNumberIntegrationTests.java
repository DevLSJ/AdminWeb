package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = "spring.datasource.url=${DISPLAY_NUMBER_TEST_DATABASE_URL:jdbc:h2:mem:list_numbers;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE}")
@AutoConfigureMockMvc
@Import(TestUserInitializer.class)
@Transactional
class ListDisplayNumberIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    private String token;

    @BeforeEach void login() throws Exception {
        token = data(json(post("/api/auth/login"), Map.of("loginId", "admin", "password", "admin"))).path("token").asText();
    }

    @Test void keysKeepCreationNumbersAcrossPagesSortAndSearch() throws Exception {
        String prefix = "number-" + UUID.randomUUID();
        JsonNode first = key(prefix + "-1"), second = key(prefix + "-2");
        assertThat(number(second)).isGreaterThan(number(first));
        JsonNode page = data(get("/api/keys").param("keyword", prefix).param("size", "1").param("sort", "createdAt,desc"));
        assertThat(number(page.path("content").get(0))).isEqualTo(number(second));
        page = data(get("/api/keys").param("keyword", prefix).param("size", "1").param("page", "1").param("sort", "createdAt,desc"));
        assertThat(number(page.path("content").get(0))).isEqualTo(number(first));
        page = data(get("/api/keys").param("keyword", prefix).param("sort", "createdAt,asc"));
        assertThat(number(page.path("content").get(0))).isEqualTo(number(first));
        page = data(get("/api/keys").param("keyword", prefix + "-2"));
        assertThat(number(page.path("content").get(0))).isEqualTo(number(second));
    }

    @Test void noticesKeepNumbersWhenPinnedFilteredAndDeleted() throws Exception {
        String prefix = "number-" + UUID.randomUUID();
        JsonNode pinned = notice(prefix + "-pinned", "NOTICE"), recent = notice(prefix + "-recent", "GENERAL");
        assertThat(number(recent)).isGreaterThan(number(pinned));
        JsonNode page = data(get("/api/notices").param("title", prefix));
        assertThat(number(page.path("content").get(0))).isEqualTo(number(pinned));
        assertThat(number(page.path("content").get(1))).isEqualTo(number(recent));
        data(delete("/api/notices/" + pinned.path("noticeUid").asText()));
        page = data(get("/api/notices").param("title", prefix));
        assertThat(number(page.path("content").get(0))).isEqualTo(number(recent));
    }

    @Test void mergedAccountsHaveUniqueNumbersThatSurviveFilteringAndPaging() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        data(json(post("/api/users"), Map.of("name", "번호검증", "phone", "010" + String.format("%08d", new Random().nextInt(100000000)),
                "email", email, "password", "sample-password!", "role", "CLIENT")));
        JsonNode content = data(get("/api/users/managed").param("size", "100")).path("content");
        List<Long> numbers = new ArrayList<>();
        for (JsonNode row : content) numbers.add(number(row));
        assertThat(numbers).doesNotHaveDuplicates().allMatch(n -> n > 0).isSortedAccordingTo(Comparator.reverseOrder());
        assertThat(content.size()).isGreaterThanOrEqualTo(4);
        JsonNode filtered = data(get("/api/users/managed").param("email", email)).path("content").get(0);
        assertThat(number(filtered)).isEqualTo(number(content.get(0)));
        JsonNode paged = data(get("/api/users/managed").param("size", "1").param("page", "1")).path("content").get(0);
        assertThat(number(paged)).isEqualTo(number(content.get(1)));
    }

    @Test void auditNumbersFollowAppendOrderWithoutChangingChainValidation() throws Exception {
        key("number-" + UUID.randomUUID());
        JsonNode content = data(get("/api/audit-logs").param("size", "100")).path("content");
        List<Long> numbers = new ArrayList<>();
        for (JsonNode row : content) numbers.add(number(row));
        assertThat(numbers).doesNotHaveDuplicates().allMatch(n -> n > 0).isSortedAccordingTo(Comparator.reverseOrder());
        JsonNode filtered = data(get("/api/audit-logs").param("action", "KEY_CREATE")).path("content");
        assertThat(number(filtered.get(0))).isEqualTo(number(content.get(0)));
        assertThat(data(get("/api/audit-logs/verify")).path("valid").asBoolean()).isTrue();
    }

    private long number(JsonNode row) { return row.path("displayNumber").asLong(); }
    private JsonNode key(String name) throws Exception {
        return data(json(post("/api/keys"), Map.of("keyName", name, "algorithm", "AES", "keySize", 256, "purpose", "ENCRYPT")));
    }
    private JsonNode notice(String title, String category) throws Exception {
        var metadata = new MockMultipartFile("metadata", "", "application/json", mapper.writeValueAsBytes(
                Map.of("title", title, "category", category, "content", "목록 번호 검증", "exposeYn", "Y")));
        return data(multipart("/api/notices").file(metadata));
    }
    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
    }
    private JsonNode data(AbstractMockHttpServletRequestBuilder<?> request) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");
    }
}
