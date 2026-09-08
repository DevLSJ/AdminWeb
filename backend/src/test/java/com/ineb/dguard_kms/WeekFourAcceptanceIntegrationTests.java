package com.ineb.dguard_kms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.ineb.dguard_kms.crypto.CryptoUtil;
import com.ineb.dguard_kms.domain.notice.repository.NoticeRepository;
import com.ineb.dguard_kms.domain.notice.repository.NoticeFileRepository;
import jakarta.persistence.EntityManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 22 explicit week-four acceptance cases; run against H2 or a disposable PostgreSQL database. */
@SpringBootTest(properties = "spring.datasource.url=${WEEK4_TEST_DATABASE_URL:jdbc:h2:mem:week_four;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE}")
@AutoConfigureMockMvc
@Import(TestUserInitializer.class)
class WeekFourAcceptanceIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired NoticeRepository notices;
    @Autowired NoticeFileRepository files;
    @Autowired CryptoUtil crypto;
    private static final byte[] CONTENT = "week-four confidential attachment 한글".getBytes(StandardCharsets.UTF_8);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Test @DisplayName("W4-01 인증 없는 게시판·파일·대시보드 요청 차단")
    void authentication() throws Exception {
        for (String path : List.of("/notices", "/notices/" + UUID.randomUUID(), "/files/" + UUID.randomUUID() + "/download", "/dashboard/summary", "/dashboard/expiring", "/dashboard/usage-trend"))
            mvc.perform(get("/api" + path)).andExpect(status().isUnauthorized()).andExpect(jsonPath("success").value(false));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":\"admin\",\"password\":\"wrong\"}")).andExpect(status().isUnauthorized());
    }

    @Test @DisplayName("W4-02 필수 10개 테이블 및 공지·첨부 컬럼 존재")
    void schema() {
        for (String table : List.of("crypto_config", "admin_user", "crypto_key", "key_material", "key_status_history", "key_usage_log", "app_user", "notice", "notice_file", "audit_log"))
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema='public' and table_name=?", Integer.class, table)).isEqualTo(1);
        assertThat(columns("notice")).contains("notice_uid", "title", "content", "expose_yn", "view_count", "created_by");
        assertThat(columns("notice_file")).contains("file_uid", "notice_id", "orig_name", "saved_name", "size", "iv", "enc_ver", "content_enc");
    }

    @Test @Transactional @DisplayName("W4-03 공지 등록·상세 본문 및 UUID 응답")
    void createAndRead() throws Exception {
        String token = login("admin");
        JsonNode notice = create(token, "NOTICE", "Y", "공지 " + UUID.randomUUID());
        assertThat(UUID.fromString(notice.path("noticeUid").asText())).isNotNull();
        assertThat(notice.path("createdBy").asText()).isEqualTo("admin");
        assertThat(notice.path("viewCount").asLong()).isZero();
        assertThat(data(get("/api/notices/" + uid(notice)), token).path("content").asText()).isEqualTo("첨부 암호화 본문");
    }

    @Test @Transactional @DisplayName("W4-04 제목·노출 검색 및 페이징")
    void searchAndPaging() throws Exception {
        String token = login("admin"), title = "검색 " + UUID.randomUUID();
        for (int i = 0; i < 3; i++) create(token, "NOTICE", "Y", title);
        create(token, "NOTICE", "N", title);
        JsonNode page = data(get("/api/notices").param("title", title).param("exposeYn", "Y").param("page", "1").param("size", "2"), token);
        assertThat(page.path("totalElements").asInt()).isEqualTo(3);
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        assertThat(page.path("page").asInt()).isEqualTo(1);
        assertThat(page.path("content")).hasSize(1);
        assertThat(page.path("content").get(0).path("exposeYn").asText()).isEqualTo("Y");
    }

    @Test @Transactional @DisplayName("W4-05 상세 조회마다 조회수 정확히 1 증가")
    void views() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "조회수");
        for (int i = 1; i <= 3; i++) assertThat(data(get("/api/notices/" + uid(n)), token).path("viewCount").asInt()).isEqualTo(i);
        assertThat(notices.findByNoticeUid(UUID.fromString(uid(n))).orElseThrow().getViewCount()).isEqualTo(3);
    }

    @Test @Transactional @DisplayName("W4-06 다중 첨부 마스터키 암호화·독립 IV·enc_ver")
    void encryptedAttachments() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "암호문", attachment("a.txt"), attachment("b.txt"));
        var a = files.findByFileUid(UUID.fromString(fileUid(n, 0))).orElseThrow();
        var b = files.findByFileUid(UUID.fromString(fileUid(n, 1))).orElseThrow();
        assertThat(a.getEncryptedContent()).isNotEqualTo(CONTENT).hasSize(CONTENT.length + 16);
        assertThat(a.getIv()).hasSize(12).isNotEqualTo(b.getIv());
        assertThat(a.getEncryptedContent()).isNotEqualTo(b.getEncryptedContent());
        assertThat(a.getEncryptionVersion()).isEqualTo(1);
        assertThat(crypto.decrypt(new CryptoUtil.EncryptedPayload(a.getIv(), a.getEncryptedContent()))).isEqualTo(CONTENT);
        assertThat(n.toString()).doesNotContain("content_enc", "encryptedContent", "wrappedKey");
    }

    @Test @Transactional @DisplayName("W4-07 복호화 다운로드 원본 바이트·캐시 차단·안전한 파일명")
    void download() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "다운로드", attachment("../보고서.txt"));
        var result = mvc.perform(get("/api/files/" + fileUid(n, 0) + "/download").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM)).andReturn().getResponse();
        assertThat(result.getContentAsByteArray()).isEqualTo(CONTENT);
        assertThat(result.getHeader("Content-Disposition")).startsWith("attachment;").contains("filename*=").doesNotContain("../");
    }

    @Test @Transactional @DisplayName("W4-08 공지 수정 시 기존 첨부 보존 및 새 첨부 추가")
    void update() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "수정 전", attachment("a.txt"));
        JsonNode updated = data(multipart(HttpMethod.PUT, "/api/notices/" + uid(n)).file(metadata("수정 후", "NOTICE", "N")).file(attachment("b.txt")), token);
        assertThat(updated.path("title").asText()).isEqualTo("수정 후");
        assertThat(updated.path("exposeYn").asText()).isEqualTo("N");
        assertThat(updated.path("files")).hasSize(2);
        assertThat(fileUid(updated, 0)).isEqualTo(fileUid(n, 0));
    }

    @Test @DisplayName("W4-09 누적 10개 제한·초과 수정 전체 롤백")
    void cumulativeLimitAndRollback() throws Exception {
        String token = login("admin");
        var request = multipart("/api/notices").file(metadata("10개 제한", "NOTICE", "Y"));
        for (int i = 0; i < 10; i++) request.file(attachment(i + ".txt"));
        JsonNode n = data(request, token);
        try {
            mvc.perform(multipart(HttpMethod.PUT, "/api/notices/" + uid(n)).file(metadata("롤백되어야 함", "NOTICE", "N")).file(attachment("11.txt"))
                    .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
            assertThat(notices.findByNoticeUid(UUID.fromString(uid(n))).orElseThrow().getTitle()).isEqualTo("10개 제한");
            assertThat(data(get("/api/notices/" + uid(n)), token).path("files")).hasSize(10);
        } finally { data(delete("/api/notices/" + uid(n)), token); }
    }

    @Test @DisplayName("W4-10 개별 10MiB 허용·초과 업로드 공지와 파일 롤백")
    void sizeLimitAndRollback() throws Exception {
        String token = login("admin");
        JsonNode n = create(token, "NOTICE", "Y", "10MiB", new MockMultipartFile("files", "limit.bin", "application/octet-stream", new byte[10 * 1024 * 1024]));
        data(delete("/api/notices/" + uid(n)), token);
        long count = notices.count(), fileCount = files.count();
        mvc.perform(multipart("/api/notices").file(metadata("초과", "NOTICE", "Y")).file(attachment("first.txt"))
                .file(new MockMultipartFile("files", "oversized.bin", "application/octet-stream", new byte[10 * 1024 * 1024 + 1]))
                .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        assertThat(notices.count()).isEqualTo(count); assertThat(files.count()).isEqualTo(fileCount);
    }

    @Test @DisplayName("W4-11 빈 제목·잘못된 노출·구분 검증")
    void validation() throws Exception {
        String token = login("admin");
        for (MockMultipartFile meta : List.of(metadata(" ", "NOTICE", "Y"), metadata("제목", "NOTICE", "X"), metadata("제목", "UNKNOWN", "Y")))
            mvc.perform(multipart("/api/notices").file(meta).header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest()).andExpect(jsonPath("success").value(false));
    }

    @Test @DisplayName("W4-12 CLIENT의 공지 등록 금지")
    void clientNoticeDenied() throws Exception {
        mvc.perform(multipart("/api/notices").file(metadata("금지", "NOTICE", "Y")).header("Authorization", "Bearer " + login("client")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("success").value(false));
    }

    @Test @Transactional @DisplayName("W4-13 숨김 글 목록·상세·첨부 인가")
    void hiddenNotice() throws Exception {
        String admin = login("admin"), client = login("client"), title = "숨김 " + UUID.randomUUID();
        JsonNode n = create(admin, "NOTICE", "N", title, attachment("hidden.txt"));
        assertThat(data(get("/api/notices").param("title", title), client).path("totalElements").asInt()).isZero();
        for (String path : List.of("/api/notices/" + uid(n), "/api/files/" + fileUid(n, 0) + "/download"))
            mvc.perform(get(path).header("Authorization", "Bearer " + client)).andExpect(status().isForbidden());
        assertThat(data(get("/api/notices/" + uid(n)), admin).path("title").asText()).isEqualTo(title);
        JsonNode own = create(client, "GENERAL", "N", "내 비공개");
        assertThat(data(get("/api/notices/" + uid(own)), client).path("exposeYn").asText()).isEqualTo("N");
    }

    @Test @Transactional @DisplayName("W4-14 타인 글·첨부 변경 차단 및 작성자 수정 허용")
    void ownership() throws Exception {
        String admin = login("admin"), client = login("client"); JsonNode n = create(admin, "GENERAL", "Y", "관리자 글", attachment("a.txt"));
        mvc.perform(delete("/api/notices/" + uid(n)).header("Authorization", "Bearer " + client)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/files/" + fileUid(n, 0)).header("Authorization", "Bearer " + client)).andExpect(status().isForbidden());
        mvc.perform(multipart(HttpMethod.PUT, "/api/notices/" + uid(n)).file(metadata("변조", "GENERAL", "Y")).header("Authorization", "Bearer " + client)).andExpect(status().isForbidden());
        JsonNode own = create(client, "GENERAL", "Y", "작성자 글");
        assertThat(data(multipart(HttpMethod.PUT, "/api/notices/" + uid(own)).file(metadata("작성자 수정", "GENERAL", "Y")), client).path("title").asText()).isEqualTo("작성자 수정");
    }

    @Test @Transactional @DisplayName("W4-15 첨부 개별 삭제 후 404, 다른 첨부 유지")
    void deleteFile() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "삭제", attachment("a.txt"), attachment("b.txt"));
        data(delete("/api/files/" + fileUid(n, 0)), token);
        mvc.perform(get("/api/files/" + fileUid(n, 0) + "/download").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        assertThat(data(get("/api/notices/" + uid(n)), token).path("files")).hasSize(1);
    }

    @Test @Transactional @DisplayName("W4-16 공지 삭제 시 첨부 함께 정리")
    void deleteNotice() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "글 삭제", attachment("a.txt"));
        data(delete("/api/notices/" + uid(n)), token); em.flush(); em.clear();
        assertThat(notices.findByNoticeUid(UUID.fromString(uid(n)))).isEmpty();
        assertThat(files.findByFileUid(UUID.fromString(fileUid(n, 0)))).isEmpty();
        mvc.perform(get("/api/notices/" + uid(n)).header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }

    @Test @Transactional @DisplayName("W4-17 변조 첨부 다운로드 거절·평문 미전송")
    void tamperedFile() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "변조", attachment("a.txt")); em.flush();
        byte[] encrypted = files.findByFileUid(UUID.fromString(fileUid(n, 0))).orElseThrow().getEncryptedContent(); encrypted[0] ^= 1;
        jdbc.update("update notice_file set content_enc=? where file_uid=?", encrypted, UUID.fromString(fileUid(n, 0))); em.clear();
        var response = mvc.perform(get("/api/files/" + fileUid(n, 0) + "/download").header("Authorization", "Bearer " + token)).andExpect(status().isConflict()).andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain("week-four confidential");
    }

    @Test @Transactional @DisplayName("W4-18 게시판 전 행위 감사기록·체인 검증·CSV")
    void boardAuditChain() throws Exception {
        String token = login("admin"); JsonNode n = create(token, "NOTICE", "Y", "감사", attachment("a.txt"));
        data(get("/api/notices/" + uid(n)), token);
        mvc.perform(get("/api/files/" + fileUid(n, 0) + "/download").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        data(multipart(HttpMethod.PUT, "/api/notices/" + uid(n)).file(metadata("감사 수정", "NOTICE", "Y")), token);
        data(delete("/api/files/" + fileUid(n, 0)), token); data(delete("/api/notices/" + uid(n)), token); em.flush();
        var actions = jdbc.queryForList("select action from audit_log where target_id in (?, ?)", String.class, uid(n), fileUid(n, 0));
        assertThat(actions).contains("NOTICE_CREATE", "NOTICE_VIEW", "NOTICE_UPDATE", "NOTICE_DELETE", "FILE_DOWNLOAD", "FILE_DELETE");
        assertThat(data(get("/api/audit-logs/verify"), token).path("valid").asBoolean()).isTrue();
        mvc.perform(get("/api/audit-logs/export").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("NOTICE_CREATE")));
    }

    @Test @Transactional @DisplayName("W4-19 대시보드 원천 DB 집계 및 사용 성공·실패 수")
    void summaryCounts() throws Exception {
        String token = login("admin"); create(token, "NOTICE", "Y", "집계"); createUser(token);
        JsonNode key = key(token, 10, true);
        data(post("/api/keys/" + key.path("keyUid").asText() + "/test/encrypt").contentType(MediaType.APPLICATION_JSON).content("{\"plaintext\":\"sample\"}"), token); em.flush();
        JsonNode s = data(get("/api/dashboard/summary"), token);
        for (String[] pair : List.of(new String[]{"totalKeys", "crypto_key"}, new String[]{"totalUsers", "app_user"}, new String[]{"totalNotices", "notice"}, new String[]{"totalOperations", "key_usage_log"}))
            assertThat(s.path(pair[0]).asLong()).isEqualTo(jdbc.queryForObject("select count(*) from " + pair[1], Long.class));
        assertThat(s.path("successfulOperations").asLong()).isEqualTo(jdbc.queryForObject("select count(*) from key_usage_log where result='SUCCESS'", Long.class));
        assertThat(s.path("totalOperations").asLong()).isEqualTo(s.path("successfulOperations").asLong() + s.path("failedOperations").asLong());
    }

    @Test @Transactional @DisplayName("W4-20 30일 만료 경계·ACTIVE 필터·정렬·일수 검증")
    void expiring() throws Exception {
        String token = login("admin"); JsonNode later = key(token, 30, true), sooner = key(token, 1, true);
        JsonNode outside = key(token, 31, true), inactive = key(token, 5, false); em.flush();
        JsonNode result = data(get("/api/dashboard/expiring"), token);
        var ids = new java.util.ArrayList<String>(); var dates = new java.util.ArrayList<String>();
        result.forEach(n -> { ids.add(n.path("keyUid").asText()); dates.add(n.path("expireAt").asText()); });
        assertThat(ids).contains(sooner.path("keyUid").asText(), later.path("keyUid").asText()).doesNotContain(outside.path("keyUid").asText(), inactive.path("keyUid").asText());
        assertThat(dates).isSorted();
        assertThat(data(get("/api/dashboard/summary"), token).path("expiringKeys").asInt()).isEqualTo(result.size());
        for (String days : List.of("0", "366", "-1")) mvc.perform(get("/api/dashboard/expiring").param("days", days).header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    }

    @Test @Transactional @DisplayName("W4-21 최근 30일 0 포함·KST 자정 경계·잘못된 범위 거절")
    void trend() throws Exception {
        String token = login("admin"); JsonNode trend = data(get("/api/dashboard/usage-trend"), token);
        assertThat(trend.path("points")).hasSize(30); assertThat(trend.path("to").asText()).isEqualTo(LocalDate.now(KST).toString());
        JsonNode key = key(token, 40, true);
        data(post("/api/keys/" + key.path("keyUid").asText() + "/test/encrypt").contentType(MediaType.APPLICATION_JSON).content("{\"plaintext\":\"sample\"}"), token); em.flush();
        jdbc.update("update key_usage_log set used_at=? where key_id=(select id from crypto_key where key_uid=?)", java.sql.Timestamp.from(java.time.Instant.parse("2001-01-01T15:00:00Z")), UUID.fromString(key.path("keyUid").asText())); em.clear();
        JsonNode points = data(get("/api/dashboard/usage-trend").param("from", "2001-01-01").param("to", "2001-01-03"), token).path("points");
        assertThat(points.get(0).path("totalOperations").asInt()).isZero(); assertThat(points.get(1).path("encryptions").asInt()).isEqualTo(1); assertThat(points.get(2).path("totalOperations").asInt()).isZero();
        mvc.perform(get("/api/dashboard/usage-trend").param("from", "2001-01-03").param("to", "2001-01-01").header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
    }

    @Test @Transactional @DisplayName("W4-22 키·사용자 변조 및 감사 체인 헤드 이상 집계")
    void integrityCounts() throws Exception {
        String token = login("admin"); JsonNode key = key(token, 10, true), user = createUser(token); em.flush();
        jdbc.update("update crypto_key set key_name=? where key_uid=?", "tampered-" + UUID.randomUUID(), UUID.fromString(key.path("keyUid").asText()));
        jdbc.update("update app_user set status='INACTIVE' where user_uid=?", UUID.fromString(user.path("userUid").asText()));
        jdbc.update("update audit_chain_head set current_hash='tampered' where id=1"); em.clear();
        JsonNode s = data(get("/api/dashboard/summary"), token);
        assertThat(s.path("keyIntegrityViolations").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(s.path("userIntegrityViolations").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(s.path("auditIntegrityViolations").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(s.path("integrityViolations").asLong()).isEqualTo(s.path("keyIntegrityViolations").asLong() + s.path("userIntegrityViolations").asLong() + s.path("auditIntegrityViolations").asLong());
    }

    private List<String> columns(String table) { return jdbc.queryForList("select column_name from information_schema.columns where table_schema='public' and table_name=?", String.class, table); }
    private String login(String id) throws Exception {
        return data(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"loginId\":\"" + id + "\",\"password\":\"" + id + "\"}"), null).path("token").asText();
    }
    private JsonNode data(AbstractMockHttpServletRequestBuilder<?> request, String token) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        MvcResult result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).path("data");
    }
    private MockMultipartFile metadata(String title, String category, String expose) {
        return new MockMultipartFile("metadata", "metadata.json", "application/json", mapper.writeValueAsBytes(java.util.Map.of("title", title, "content", "첨부 암호화 본문", "category", category, "exposeYn", expose)));
    }
    private MockMultipartFile attachment(String name) { return new MockMultipartFile("files", name, "text/plain", CONTENT.clone()); }
    private JsonNode create(String token, String category, String expose, String title, MockMultipartFile... attachments) throws Exception {
        var request = multipart("/api/notices").file(metadata(title, category, expose)); for (var file : attachments) request.file(file); return data(request, token);
    }
    private String uid(JsonNode notice) { return notice.path("noticeUid").asText(); }
    private String fileUid(JsonNode notice, int i) { return notice.path("files").get(i).path("fileUid").asText(); }
    private JsonNode key(String token, int days, boolean active) throws Exception {
        JsonNode key = data(post("/api/keys").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(java.util.Map.of("keyName", "week4-" + UUID.randomUUID(), "algorithm", "AES", "mode", "GCM", "keySize", 256, "purpose", "ENCRYPT", "expireAt", LocalDate.now(KST).plusDays(days).toString()))), token);
        if (active) data(patch("/api/keys/" + key.path("keyUid").asText() + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"toStatus\":\"ACTIVE\",\"reason\":\"수용 테스트\"}"), token);
        return key;
    }
    private JsonNode createUser(String token) throws Exception {
        return data(post("/api/users").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(java.util.Map.of("name", "테스트", "phone", "010-1234-5678", "email", UUID.randomUUID() + "@example.com", "password", "Week4-Secure-1234!"))), token);
    }
}
